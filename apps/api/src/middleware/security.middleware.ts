import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import express, { Application, RequestHandler } from 'express';
import { env, getCorsOrigins, isTest } from '../config/env.js';

// ---------------------------------------------------------------------------
// Security middleware bundle
// ---------------------------------------------------------------------------

export function applySecurityMiddleware(app: Application): void {
  // --- Helmet: sensible security headers ---
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: env.NODE_ENV === 'production',
    }),
  );

  // --- CORS ---
  const origins = getCorsOrigins();
  app.use(
    cors({
      origin: origins.length === 1 ? origins[0] : origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
    }),
  );

  // --- Body parsers & Cookie parser ---
  // Candidate audio is base64 encoded and needs a larger bound than other API requests.
  app.use(`${env.API_PREFIX}/interview`, express.json({ limit: '8mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // --- Global rate limiter ---
  const globalLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest(),
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down.',
      },
    },
  });
  app.use(globalLimiter);

  // --- Stricter rate limit for auth routes ---
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest(),
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts. Please try again later.',
      },
    },
  }) as unknown as RequestHandler;
  app.use(`${env.API_PREFIX}/auth`, authLimiter);
}
