import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { isTest } from '../../config/env.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import * as authController from './auth.controller.js';

const authRouter = Router();

// Rate limiter for brute-force prevention on authentication attempts
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest(),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
    },
  },
}) as unknown as RequestHandler;

authRouter.post('/register', strictAuthLimiter, asyncHandler(authController.register));
authRouter.post('/login', strictAuthLimiter, asyncHandler(authController.login));
authRouter.post('/refresh', asyncHandler(authController.refresh));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.post('/verify-email', asyncHandler(authController.verifyEmail));
authRouter.post('/resend-verification', strictAuthLimiter, asyncHandler(authController.resendVerification));
authRouter.post('/forgot-password', strictAuthLimiter, asyncHandler(authController.forgotPassword));
authRouter.post('/reset-password', strictAuthLimiter, asyncHandler(authController.resetPassword));

export default authRouter;
