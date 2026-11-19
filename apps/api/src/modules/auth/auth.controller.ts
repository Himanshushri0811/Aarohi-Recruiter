import { Request, Response } from 'express';
import { type CookieOptions } from 'express';
import { env } from '../../config/env.js';
import { success } from '../../common/utils/helpers.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
} from './auth.schemas.js';
import * as authService from './auth.service.js';

export const REFRESH_COOKIE_NAME = 'aarohi_refresh_token';

export function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: `${env.API_PREFIX}/auth`,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json(
    success({
      message: 'Registration successful. Please check your email to verify your account.',
      user: result.user,
      ...(result.devVerificationToken
        ? {
            devVerificationToken: result.devVerificationToken,
            devVerificationUrl: result.devVerificationUrl,
          }
        : {}),
    }),
  );
}

export async function resendVerification(req: Request, res: Response) {
  const input = resendVerificationSchema.parse(req.body);
  const result = await authService.resendVerification(input.email, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(200).json(success(result));
}

export async function verifyEmail(req: Request, res: Response) {
  const input = verifyEmailSchema.parse(req.body);
  const result = await authService.verifyEmail(input.token);

  res.status(200).json(
    success({
      message: result.message,
      alreadyVerified: result.alreadyVerified,
    }),
  );
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

  res.status(200).json(
    success({
      accessToken: result.accessToken,
      user: result.user,
    }),
  );
}

export async function refresh(req: Request, res: Response) {
  // Support refresh token from cookie or body (for non-browser clients)
  const refreshToken = (req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken) as string;

  const result = await authService.refreshTokens(refreshToken, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

  res.status(200).json(
    success({
      accessToken: result.accessToken,
    }),
  );
}

export async function logout(req: Request, res: Response) {
  const refreshToken = (req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken) as string;

  await authService.logout(refreshToken);

  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...getRefreshCookieOptions(),
    maxAge: 0,
  });

  res.status(200).json(
    success({
      message: 'Successfully logged out',
    }),
  );
}

export async function forgotPassword(req: Request, res: Response) {
  const input = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(input.email, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Always return generic success to prevent email enumeration
  res.status(200).json(
    success({
      message: 'If an account with that email exists, password reset instructions have been sent.',
    }),
  );
}

export async function resetPassword(req: Request, res: Response) {
  const input = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(input, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(200).json(
    success({
      message: 'Password has been successfully reset. Please log in with your new password.',
    }),
  );
}
