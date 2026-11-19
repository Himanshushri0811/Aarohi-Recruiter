import { z } from 'zod';

// ---------------------------------------------------------------------------
// Environment schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  API_PREFIX: z.string().default('/api/v1'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // CORS — comma-separated origins
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),

  // JWT
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  // Cookies
  COOKIE_DOMAIN: z.string().default(''),
  COOKIE_SECURE: z
    .enum(['true', 'false', ''])
    .transform((v) => v === 'true')
    .default('false'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000), // 15 min
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  // JWT expiry
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // AI Service & Interview
  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  AI_SERVICE_SECRET: z
    .string()
    .min(32, 'AI_SERVICE_SECRET must be at least 32 characters')
    .refine((value) => !value.includes('change_this_to'), {
      message: 'AI_SERVICE_SECRET must not be a placeholder value',
    }),
  INTERVIEW_TOKEN_EXPIRY_HOURS: z.coerce.number().int().positive().default(72),
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),

  // Email & Verification
  APP_URL: z.string().default('http://localhost:3000'),
  EMAIL_VERIFICATION_REQUIRED: z
    .enum(['true', 'false', ''])
    .transform((v) => (v === '' ? true : v === 'true'))
    .default('true'),
  EMAIL_FROM: z.string().default('noreply@aarohi.local'),
  EMAIL_PROVIDER: z.enum(['smtp', 'console', 'brevo']).default('console'),
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default('Aarohi Recruiter'),
  EMAIL_FROM_ADDRESS: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false', ''])
    .transform((v) => v === 'true')
    .default('false'),
});

export type Env = z.infer<typeof envSchema>;

// ---------------------------------------------------------------------------
// Validation — throws on startup if config is invalid
// ---------------------------------------------------------------------------

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment configuration is invalid:\n${formatted}`);
  }

  // Enforce rule: Production must always enforce email verification
  if (result.data.NODE_ENV === 'production' && !result.data.EMAIL_VERIFICATION_REQUIRED) {
    throw new Error('EMAIL_VERIFICATION_REQUIRED must always be true in production');
  }

  return result.data;
}

// Singleton — evaluated once at import time.
// Throws immediately on misconfiguration to fail fast.
export const env: Env = validateEnv();

// Convenience helpers
export const isProduction = (): boolean =>
  process.env.NODE_ENV ? process.env.NODE_ENV === 'production' : env.NODE_ENV === 'production';
export const isDevelopment = (): boolean =>
  process.env.NODE_ENV ? process.env.NODE_ENV === 'development' : env.NODE_ENV === 'development';
export const isTest = (): boolean =>
  process.env.NODE_ENV ? process.env.NODE_ENV === 'test' : env.NODE_ENV === 'test';

export const getCorsOrigins = (): string[] =>
  env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
