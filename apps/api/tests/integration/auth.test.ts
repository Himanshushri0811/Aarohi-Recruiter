import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Application } from 'express';
import { inProcess } from '../helpers/in-process.js';
import { hashPassword, hashToken } from '../../src/modules/auth/auth.service.js';

// ---------------------------------------------------------------------------
// In-Memory Database Store for Testing
// ---------------------------------------------------------------------------

interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified: boolean;
  status: string;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  memberships: any[];
}

interface MockRefreshToken {
  id: string;
  tokenHash: string;
  userId: string;
  family: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  user?: MockUser;
}

interface MockVerificationToken {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  user?: MockUser;
}

interface MockResetToken {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  user?: MockUser;
}

let users: MockUser[] = [];
let refreshTokens: MockRefreshToken[] = [];
let verificationTokens: MockVerificationToken[] = [];
let resetTokens: MockResetToken[] = [];
let auditLogs: any[] = [];

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
      const u = users.find((user) => (where.email ? user.email === where.email : user.id === where.id));
      if (!u) return null;
      return { ...u, memberships: u.memberships || [] };
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const newUser: MockUser = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        emailVerified: data.emailVerified ?? false,
        status: data.status ?? 'PENDING_VERIFICATION',
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [],
      };
      users.push(newUser);
      return newUser;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const u = users.find((user) => user.id === where.id);
      if (!u) throw new Error('User not found');
      Object.assign(u, data, { updatedAt: new Date() });
      return u;
    }),
  },
  refreshToken: {
    findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
      const t = refreshTokens.find((tok) => tok.tokenHash === where.tokenHash);
      if (!t) return null;
      const u = users.find((user) => user.id === t.userId);
      return { ...t, user: u ? { ...u, memberships: u.memberships || [] } : undefined };
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const newToken: MockRefreshToken = {
        id: `rt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tokenHash: data.tokenHash,
        userId: data.userId,
        family: data.family,
        expiresAt: data.expiresAt,
        revokedAt: null,
        createdAt: new Date(),
      };
      refreshTokens.push(newToken);
      return newToken;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const t = refreshTokens.find((tok) => tok.id === where.id);
      if (t) Object.assign(t, data);
      return t;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: any; data: any }) => {
      let count = 0;
      refreshTokens.forEach((tok) => {
        const matchesFamily = where.family ? tok.family === where.family : true;
        const matchesTokenHash = where.tokenHash ? tok.tokenHash === where.tokenHash : true;
        const matchesUserId = where.userId ? tok.userId === where.userId : true;
        const matchesRevokedAt = where.revokedAt === null ? tok.revokedAt === null : true;

        if (matchesFamily && matchesTokenHash && matchesUserId && matchesRevokedAt) {
          Object.assign(tok, data);
          count++;
        }
      });
      return { count };
    }),
  },
  emailVerificationToken: {
    findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
      const t = verificationTokens.find((tok) => tok.tokenHash === where.tokenHash);
      if (!t) return null;
      const u = users.find((user) => user.id === t.userId);
      return { ...t, user: u };
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const token: MockVerificationToken = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tokenHash: data.tokenHash,
        userId: data.userId,
        expiresAt: data.expiresAt,
        usedAt: null,
        createdAt: new Date(),
      };
      verificationTokens.push(token);
      return token;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const t = verificationTokens.find((tok) => tok.id === where.id);
      if (t) Object.assign(t, data);
      return t;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: any; data: any }) => {
      let count = 0;
      verificationTokens.forEach((tok) => {
        const matchesUserId = where.userId ? tok.userId === where.userId : true;
        const matchesUsedAt = where.usedAt === null ? tok.usedAt === null : true;
        if (matchesUserId && matchesUsedAt) {
          Object.assign(tok, data);
          count++;
        }
      });
      return { count };
    }),
  },
  passwordResetToken: {
    findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
      const t = resetTokens.find((tok) => tok.tokenHash === where.tokenHash);
      if (!t) return null;
      const u = users.find((user) => user.id === t.userId);
      return { ...t, user: u };
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const token: MockResetToken = {
        id: `prt_${Date.now()}`,
        tokenHash: data.tokenHash,
        userId: data.userId,
        expiresAt: data.expiresAt,
        usedAt: null,
        createdAt: new Date(),
      };
      resetTokens.push(token);
      return token;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const t = resetTokens.find((tok) => tok.id === where.id);
      if (t) Object.assign(t, data);
      return t;
    }),
  },
  auditLog: {
    create: vi.fn(async ({ data }: { data: any }) => {
      auditLogs.push(data);
      return { id: `al_${Date.now()}`, ...data, createdAt: new Date() };
    }),
  },
  $transaction: vi.fn(async (arg: any) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    if (typeof arg === 'function') {
      return arg(mockPrisma);
    }
    return arg;
  }),
};

// Mock the database config module to return mockPrisma
vi.mock('../../src/config/database.js', () => ({
  getPrismaClient: () => mockPrisma,
  disconnectPrisma: vi.fn(),
}));

let app: Application;

beforeAll(async () => {
  const { createApp } = await import('../../src/app.js');
  app = createApp();
});

beforeEach(() => {
  users = [];
  refreshTokens = [];
  verificationTokens = [];
  resetTokens = [];
  auditLogs = [];
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Authentication API Integration Tests', () => {
  describe('POST /api/v1/auth/register', () => {
    it('successfully registers a new user with pending verification', async () => {
      const res = await inProcess(app, 'POST', '/api/v1/auth/register', {
        body: {
          email: 'jane.recruiter@example.com',
          password: 'Password123!',
          firstName: 'Jane',
          lastName: 'Recruiter',
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toMatch(/Registration successful/i);
      expect(res.body.data.user.email).toBe('jane.recruiter@example.com');
      expect(res.body.data.user.status).toBe('PENDING_VERIFICATION');
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // In non-production environments, dev verification tokens are supplied for local workflows
      expect(res.body.data.devVerificationToken).toBeDefined();
      expect(res.body.data.devVerificationUrl).toContain('/verify-email?token=');

      // Verification token was created
      expect(verificationTokens).toHaveLength(1);
    });

    it('rejects duplicate registration with 409 conflict', async () => {
      // First registration
      await inProcess(app, 'POST', '/api/v1/auth/register', {
        body: {
          email: 'duplicate@example.com',
          password: 'Password123!',
          firstName: 'First',
          lastName: 'User',
        },
      });

      // Second registration with same email
      const res = await inProcess(app, 'POST', '/api/v1/auth/register', {
        body: {
          email: 'duplicate@example.com',
          password: 'DifferentPassword123!',
          firstName: 'Second',
          lastName: 'User',
        },
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('validates input and rejects weak passwords with 422 Unprocessable', async () => {
      const res = await inProcess(app, 'POST', '/api/v1/auth/register', {
        body: {
          email: 'invalid-email',
          password: 'weak',
          firstName: '',
          lastName: '',
        },
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.details).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('successfully verifies email and activates user account', async () => {
      const user = await mockPrisma.user.create({
        data: {
          email: 'verify.me@example.com',
          passwordHash: 'dummy',
          firstName: 'Verify',
          lastName: 'Me',
          emailVerified: false,
          status: 'PENDING_VERIFICATION',
        },
      });

      const rawToken = 'raw-test-verification-token';
      const tokenHash = hashToken(rawToken);
      verificationTokens.push({
        id: 'evt_1',
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
        user,
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/verify-email', {
        body: { token: rawToken },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify user updated to ACTIVE and emailVerified: true
      const updatedUser = users.find((u) => u.id === user.id);
      expect(updatedUser?.emailVerified).toBe(true);
      expect(updatedUser?.status).toBe('ACTIVE');
    });

    it('rejects expired or invalid email verification token with 400 Bad Request', async () => {
      const res = await inProcess(app, 'POST', '/api/v1/auth/verify-email', {
        body: { token: 'completely-invalid-or-expired-token' },
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('rejects already used verification token if user is unverified', async () => {
      const user = await mockPrisma.user.create({
        data: {
          email: 'alreadyused@example.com',
          passwordHash: 'dummy',
          emailVerified: false,
          status: 'PENDING_VERIFICATION',
        },
      });

      const rawToken = 'single-use-token-abc';
      const tokenHash = hashToken(rawToken);
      verificationTokens.push({
        id: 'evt_used',
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: new Date(Date.now() - 5000), // Already used!
        createdAt: new Date(),
        user,
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/verify-email', {
        body: { token: rawToken },
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/invalid or expired/i);
    });

    it('returns already verified state when verifying a token for an already verified user', async () => {
      const user = await mockPrisma.user.create({
        data: {
          email: 'already.active@example.com',
          passwordHash: 'dummy',
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      const rawToken = 'already-verified-token-xyz';
      const tokenHash = hashToken(rawToken);
      verificationTokens.push({
        id: 'evt_active',
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
        user,
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/verify-email', {
        body: { token: rawToken },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alreadyVerified).toBe(true);
      expect(res.body.data.message).toMatch(/already verified/i);
    });
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    it('invalidates prior verification tokens and generates a new one for unverified user', async () => {
      const user = await mockPrisma.user.create({
        data: {
          email: 'resend.test@example.com',
          passwordHash: 'dummy',
          emailVerified: false,
          status: 'PENDING_VERIFICATION',
        },
      });

      // Prior active token
      verificationTokens.push({
        id: 'evt_old_1',
        tokenHash: 'old_hash_1',
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
        user,
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/resend-verification', {
        body: { email: 'resend.test@example.com' },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toMatch(/verification link has been sent/i);
      expect(res.body.data.devVerificationToken).toBeDefined();

      // Old token should be invalidated
      const oldToken = verificationTokens.find((t) => t.id === 'evt_old_1');
      expect(oldToken?.usedAt).not.toBeNull();

      // New token created
      const newToken = verificationTokens.find((t) => t.id !== 'evt_old_1');
      expect(newToken).toBeDefined();
      expect(newToken?.usedAt).toBeNull();
    });

    it('responds generic 200 without creating tokens for unknown email to prevent enumeration', async () => {
      const res = await inProcess(app, 'POST', '/api/v1/auth/resend-verification', {
        body: { email: 'nonexistent-user@example.com' },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toMatch(/verification link has been sent/i);
      expect(verificationTokens).toHaveLength(0);
    });

    it('informs user generic success without token if email is already verified', async () => {
      await mockPrisma.user.create({
        data: {
          email: 'already.verified@example.com',
          passwordHash: 'dummy',
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/resend-verification', {
        body: { email: 'already.verified@example.com' },
      });

      expect(res.status).toBe(200);
      expect(res.body.data.alreadyVerified).toBe(true);
      expect(res.body.data.message).toMatch(/already verified/i);
      expect(verificationTokens).toHaveLength(0);
    });
  });

  describe('End-to-End Registration -> Email Verification -> Login Flow', () => {
    it('completes the entire onboarding lifecycle with dev token', async () => {
      // 1. Register
      const registerRes = await inProcess(app, 'POST', '/api/v1/auth/register', {
        body: {
          email: 'fullcycle@example.com',
          password: 'ComplexPassword123!',
          firstName: 'Full',
          lastName: 'Cycle',
        },
      });

      expect(registerRes.status).toBe(201);
      const devToken = registerRes.body.data.devVerificationToken;
      expect(devToken).toBeDefined();

      // 2. Attempt login before verification -> should fail with 403 EMAIL_NOT_VERIFIED
      const preVerifyLogin = await inProcess(app, 'POST', '/api/v1/auth/login', {
        body: {
          email: 'fullcycle@example.com',
          password: 'ComplexPassword123!',
        },
      });
      expect(preVerifyLogin.status).toBe(403);
      expect(preVerifyLogin.body.error.code).toBe('EMAIL_NOT_VERIFIED');
      expect(preVerifyLogin.body.error.message).toMatch(/verify your email/i);

      // 3. Verify email with devToken
      const verifyRes = await inProcess(app, 'POST', '/api/v1/auth/verify-email', {
        body: { token: devToken },
      });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);

      // 4. Attempt login after verification -> should succeed with 200 & access token
      const postVerifyLogin = await inProcess(app, 'POST', '/api/v1/auth/login', {
        body: {
          email: 'fullcycle@example.com',
          password: 'ComplexPassword123!',
        },
      });
      expect(postVerifyLogin.status).toBe(200);
      expect(postVerifyLogin.body.success).toBe(true);
      expect(postVerifyLogin.body.data.accessToken).toBeDefined();
      expect(postVerifyLogin.body.data.user.email).toBe('fullcycle@example.com');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('authenticates active user, sets httpOnly cookie, and returns access token', async () => {
      const passwordHash = await hashPassword('SecurePass123!');
      await mockPrisma.user.create({
        data: {
          email: 'active.user@example.com',
          passwordHash,
          firstName: 'Active',
          lastName: 'User',
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/login', {
        body: {
          email: 'active.user@example.com',
          password: 'SecurePass123!',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('active.user@example.com');
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // Check cookie
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join(';') : String(cookieHeader);
      expect(cookieStr).toContain('aarohi_refresh_token=');
      expect(cookieStr).toMatch(/HttpOnly/i);
    });

    it('rejects login with invalid password with generic 401 error', async () => {
      const passwordHash = await hashPassword('RealPassword123!');
      await mockPrisma.user.create({
        data: {
          email: 'wrongpass@example.com',
          passwordHash,
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/login', {
        body: {
          email: 'wrongpass@example.com',
          password: 'IncorrectPassword999!',
        },
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('rejects login for non-existent user with identical generic 401 message', async () => {
      const res = await inProcess(app, 'POST', '/api/v1/auth/login', {
        body: {
          email: 'doesnotexist@example.com',
          password: 'Password123!',
        },
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('rejects login if user has not verified email with 403 EMAIL_NOT_VERIFIED', async () => {
      const passwordHash = await hashPassword('Password123!');
      await mockPrisma.user.create({
        data: {
          email: 'unverified@example.com',
          passwordHash,
          emailVerified: false,
          status: 'PENDING_VERIFICATION',
        },
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/login', {
        body: {
          email: 'unverified@example.com',
          password: 'Password123!',
        },
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
      expect(res.body.error.message).toMatch(/verify your email/i);
    });
  });

  describe('POST /api/v1/auth/refresh & Token Rotation', () => {
    it('rotates refresh token and returns new access token', async () => {
      const user = await mockPrisma.user.create({
        data: {
          email: 'rotate@example.com',
          passwordHash: 'dummy',
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      const rawOldToken = 'raw-old-refresh-token';
      const tokenHash = hashToken(rawOldToken);
      refreshTokens.push({
        id: 'rt_1',
        tokenHash,
        userId: user.id,
        family: 'fam_1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        user,
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/refresh', {
        headers: {
          cookie: `aarohi_refresh_token=${rawOldToken}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      // Old token should be revoked
      const oldToken = refreshTokens.find((t) => t.id === 'rt_1');
      expect(oldToken?.revokedAt).not.toBeNull();

      // New token created in same family
      const newToken = refreshTokens.find((t) => t.id !== 'rt_1');
      expect(newToken).toBeDefined();
      expect(newToken?.family).toBe('fam_1');
    });

    it('detects token reuse and revokes entire family', async () => {
      const user = await mockPrisma.user.create({
        data: {
          email: 'reuse@example.com',
          passwordHash: 'dummy',
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      const rawStolenToken = 'raw-stolen-token';
      const tokenHash = hashToken(rawStolenToken);

      // Token is already revoked
      refreshTokens.push({
        id: 'rt_already_used',
        tokenHash,
        userId: user.id,
        family: 'stolen_family_123',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(Date.now() - 60000), // revoked 1 min ago
        createdAt: new Date(),
        user,
      });

      // Legitimate active token in the same family
      refreshTokens.push({
        id: 'rt_active_child',
        tokenHash: 'hash-of-active-child',
        userId: user.id,
        family: 'stolen_family_123',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        user,
      });

      // Attacker tries to use the already revoked token
      const res = await inProcess(app, 'POST', '/api/v1/auth/refresh', {
        headers: {
          cookie: `aarohi_refresh_token=${rawStolenToken}`,
        },
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/reuse detected/i);

      // Entire family should now be revoked!
      const activeChild = refreshTokens.find((t) => t.id === 'rt_active_child');
      expect(activeChild?.revokedAt).not.toBeNull();
    });

    it('rejects expired refresh token', async () => {
      const user = await mockPrisma.user.create({
        data: {
          email: 'expired@example.com',
          passwordHash: 'dummy',
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      const rawExpired = 'raw-expired-token';
      refreshTokens.push({
        id: 'rt_exp',
        tokenHash: hashToken(rawExpired),
        userId: user.id,
        family: 'fam_exp',
        expiresAt: new Date(Date.now() - 1000), // Expired
        revokedAt: null,
        createdAt: new Date(),
        user,
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/refresh', {
        headers: {
          cookie: `aarohi_refresh_token=${rawExpired}`,
        },
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/expired/i);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('revokes refresh token and clears cookie', async () => {
      const rawToken = 'raw-logout-token';
      refreshTokens.push({
        id: 'rt_logout',
        tokenHash: hashToken(rawToken),
        userId: 'usr_1',
        family: 'fam_1',
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/logout', {
        headers: {
          cookie: `aarohi_refresh_token=${rawToken}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const token = refreshTokens.find((t) => t.id === 'rt_logout');
      expect(token?.revokedAt).not.toBeNull();
    });
  });

  describe('POST /api/v1/auth/forgot-password & reset-password', () => {
    it('always responds 200 for forgot password to prevent user enumeration', async () => {
      const res = await inProcess(app, 'POST', '/api/v1/auth/forgot-password', {
        body: { email: 'nonexistent@example.com' },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toMatch(/instructions have been sent/i);
    });

    it('completes password reset and revokes all active refresh tokens', async () => {
      const user = await mockPrisma.user.create({
        data: {
          email: 'reset.user@example.com',
          passwordHash: await hashPassword('OldPassword123!'),
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      // Existing active refresh token
      refreshTokens.push({
        id: 'rt_user_active',
        tokenHash: 'some_hash',
        userId: user.id,
        family: 'fam_u',
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const rawResetToken = 'raw-reset-token-123';
      resetTokens.push({
        id: 'prt_1',
        tokenHash: hashToken(rawResetToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        createdAt: new Date(),
        user,
      });

      const res = await inProcess(app, 'POST', '/api/v1/auth/reset-password', {
        body: {
          token: rawResetToken,
          password: 'NewSuperPassword123!',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify reset token marked used
      const prt = resetTokens.find((t) => t.id === 'prt_1');
      expect(prt?.usedAt).not.toBeNull();

      // Verify all active refresh tokens for user were revoked
      const rt = refreshTokens.find((t) => t.id === 'rt_user_active');
      expect(rt?.revokedAt).not.toBeNull();
    });

    it('rejects invalid or expired reset token with 400', async () => {
      const res = await inProcess(app, 'POST', '/api/v1/auth/reset-password', {
        body: {
          token: 'invalid-or-nonexistent-token',
          password: 'NewSuperPassword123!',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('Production Security & Safe Failure Behaviors', () => {
    it('never exposes devVerificationToken in production environment', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        const res = await inProcess(app, 'POST', '/api/v1/auth/register', {
          body: {
            email: 'prod.user@example.com',
            password: 'ProdPassword123!',
            firstName: 'Prod',
            lastName: 'User',
          },
        });

        // Registration completes or fails safely, but must NOT leak dev tokens
        expect(res.body.data?.devVerificationToken).toBeUndefined();
        expect(res.body.data?.devVerificationUrl).toBeUndefined();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('fails safely with 503 when SMTP is not configured in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const { sendVerificationEmail, setEmailProvider } = await import('../../src/integrations/email.service.js');
      try {
        process.env.NODE_ENV = 'production';
        setEmailProvider(null); // Reset cached provider so it resolves under production rules
        await expect(
          sendVerificationEmail('test@example.com', 'raw-token')
        ).rejects.toThrow(/Email delivery provider is unconfigured in production/i);
      } finally {
        setEmailProvider(null);
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });
});
