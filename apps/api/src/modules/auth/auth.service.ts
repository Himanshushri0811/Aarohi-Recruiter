import crypto from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { getPrismaClient } from '../../config/database.js';
import { env, isProduction } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { AuthPayload } from '../../common/types/index.js';
import { omit } from '../../common/utils/helpers.js';
import { createAuditLog } from '../audit/audit.service.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../integrations/email.service.js';
import {
  RegisterInput,
  LoginInput,
  ResetPasswordInput,
} from './auth.schemas.js';

// Pre-computed dummy hash to prevent timing attacks during user lookup failure
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHQxMjM0NTY3OA$9vX+lJ0/zN7M0e0T9s/q7j9k4Q8r3Z0p5W6t7Y8u9V0';

// ---------------------------------------------------------------------------
// Cryptographic Helpers
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRawToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export async function generateAccessToken(payload: {
  sub: string;
  email: string;
  organizationId?: string;
  role?: string;
}): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  return new SignJWT({
    sub: payload.sub,
    email: payload.email,
    organizationId: payload.organizationId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('aarohi-api')
    .setAudience('aarohi-web')
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload & AuthPayload> {
  try {
    const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'aarohi-api',
      audience: 'aarohi-web',
    });
    return payload as unknown as JWTPayload & AuthPayload;
  } catch {
    throw AppError.unauthorized('Invalid, expired, or malformed access token');
  }
}

// ---------------------------------------------------------------------------
// Auth Service Operations
// ---------------------------------------------------------------------------

export async function register(
  input: RegisterInput,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const prisma = getPrismaClient();

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw AppError.conflict('An account with this email address already exists');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      emailVerified: false,
      status: 'PENDING_VERIFICATION',
    },
  });

  // Generate Email Verification Token (24h validity)
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  const verificationUrl = await sendVerificationEmail(user.email, rawToken);

  await createAuditLog({
    userId: user.id,
    action: 'user.registered',
    entityType: 'User',
    entityId: user.id,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    user: omit(user, ['passwordHash']),
    // Only exposed in development/test, NEVER in production
    ...(!isProduction()
      ? { devVerificationToken: rawToken, devVerificationUrl: verificationUrl }
      : {}),
  };
}

export async function resendVerification(
  email: string,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return generic response to prevent email enumeration if account doesn't exist
  if (!user) {
    return {
      message:
        'If an account with this email exists and is pending verification, a new verification link has been sent.',
    };
  }

  if (user.emailVerified) {
    return {
      message: 'This email address is already verified. You may log in directly.',
      alreadyVerified: true,
    };
  }

  // Invalidate any existing unused verification tokens for this user
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Generate new verification token (24h)
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  const verificationUrl = await sendVerificationEmail(user.email, rawToken);

  await createAuditLog({
    userId: user.id,
    action: 'auth.verification_resent',
    entityType: 'User',
    entityId: user.id,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    message:
      'If an account with this email exists and is pending verification, a new verification link has been sent.',
    ...(!isProduction()
      ? { devVerificationToken: rawToken, devVerificationUrl: verificationUrl }
      : {}),
  };
}

export async function verifyEmail(token: string) {
  const prisma = getPrismaClient();
  const tokenHash = hashToken(token);

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!verificationToken) {
    throw AppError.badRequest('Invalid or expired verification token');
  }

  // If already used, check if the user is already verified
  if (verificationToken.usedAt !== null) {
    if (verificationToken.user?.emailVerified) {
      return {
        message: 'Your email address is already verified. You may now log in.',
        alreadyVerified: true,
      };
    }
    throw AppError.badRequest('Invalid or expired verification token');
  }

  if (verificationToken.expiresAt < new Date()) {
    throw AppError.badRequest('Verification token has expired. Please request a new verification link.');
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
      },
    }),
  ]);

  await createAuditLog({
    userId: verificationToken.userId,
    action: 'user.email_verified',
    entityType: 'User',
    entityId: verificationToken.userId,
  });

  return {
    message: 'Email successfully verified. You may now log in.',
    alreadyVerified: false,
  };
}

export async function login(
  input: LoginInput,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      memberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!user) {
    // Constant-time dummy verification
    await verifyPassword(DUMMY_HASH, input.password);
    throw AppError.unauthorized('Invalid email or password');
  }

  const isValidPassword = await verifyPassword(user.passwordHash, input.password);
  if (!isValidPassword) {
    throw AppError.unauthorized('Invalid email or password');
  }

  if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
    throw AppError.forbidden('Your account has been suspended or deactivated');
  }

  if (user.status === 'PENDING_VERIFICATION' || !user.emailVerified) {
    throw AppError.emailNotVerified('Please verify your email address before logging in');
  }

  // Determine active organization / role if user belongs to one
  const primaryMembership = user.memberships[0];
  const organizationId = primaryMembership?.organizationId;
  const role = primaryMembership?.role;

  const accessToken = await generateAccessToken({
    sub: user.id,
    email: user.email,
    organizationId,
    role,
  });

  // Generate Refresh Token with rotation family (7 days)
  const rawRefreshToken = generateRawToken();
  const tokenHash = hashToken(rawRefreshToken);
  const family = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      family,
      expiresAt,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createAuditLog({
    userId: user.id,
    organizationId,
    action: 'user.login',
    entityType: 'User',
    entityId: user.id,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: omit(user, ['passwordHash']),
  };
}

export async function refreshTokens(
  rawRefreshToken: string,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  if (!rawRefreshToken) {
    throw AppError.unauthorized('Refresh token is required');
  }

  const prisma = getPrismaClient();
  const tokenHash = hashToken(rawRefreshToken);

  const existingToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          memberships: true,
        },
      },
    },
  });

  if (!existingToken) {
    throw AppError.unauthorized('Invalid refresh token');
  }

  // REUSE DETECTION: If token was already revoked, invalidate entire family!
  if (existingToken.revokedAt !== null) {
    await prisma.refreshToken.updateMany({
      where: { family: existingToken.family },
      data: { revokedAt: new Date() },
    });

    await createAuditLog({
      userId: existingToken.userId,
      action: 'auth.token_reuse_detected',
      entityType: 'RefreshToken',
      entityId: existingToken.id,
      metadata: { family: existingToken.family },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    throw AppError.unauthorized('Refresh token reuse detected. All sessions in family revoked.');
  }

  if (existingToken.expiresAt < new Date()) {
    await prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized('Refresh token has expired');
  }

  const user = existingToken.user;
  if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
    throw AppError.forbidden('Your account has been suspended or deactivated');
  }

  // Rotate token: revoke current token and issue new token in the same family
  const newRawRefreshToken = generateRawToken();
  const newTokenHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        userId: user.id,
        family: existingToken.family,
        expiresAt: newExpiresAt,
      },
    }),
  ]);

  const primaryMembership = user.memberships[0];
  const newAccessToken = await generateAccessToken({
    sub: user.id,
    email: user.email,
    organizationId: primaryMembership?.organizationId,
    role: primaryMembership?.role,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
  };
}

export async function logout(rawRefreshToken?: string) {
  if (!rawRefreshToken) return;

  const prisma = getPrismaClient();
  const tokenHash = hashToken(rawRefreshToken);

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function forgotPassword(
  email: string,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always succeed silently to prevent user enumeration
  if (!user) {
    return;
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  await sendPasswordResetEmail(user.email, rawToken);

  await createAuditLog({
    userId: user.id,
    action: 'auth.password_reset_requested',
    entityType: 'User',
    entityId: user.id,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
}

export async function resetPassword(
  input: ResetPasswordInput,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const prisma = getPrismaClient();
  const tokenHash = hashToken(input.token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt < new Date()
  ) {
    throw AppError.badRequest('Invalid or expired password reset token');
  }

  const newPasswordHash = await hashPassword(input.password);

  // Update password, mark token used, and revoke all active refresh tokens
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: newPasswordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await createAuditLog({
    userId: resetToken.userId,
    action: 'auth.password_reset_completed',
    entityType: 'User',
    entityId: resetToken.userId,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
}
