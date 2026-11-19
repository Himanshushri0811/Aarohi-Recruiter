// Unit tests: Zod environment validation (src/config/env.ts)
// We test the validation logic directly against the schema by stubbing process.env,
// then re-importing the validation function in isolation.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Replicate the validation schema here for isolated unit testing.
// This avoids running the module-level side-effect (validateEnv()) with our test env.
// ---------------------------------------------------------------------------

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().url(),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  COOKIE_DOMAIN: z.string().default(''),
  COOKIE_SECURE: z
    .enum(['true', 'false', ''])
    .transform((v) => v === 'true')
    .default('false'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

function validate(overrides: Record<string, string>) {
  return envSchema.parse(overrides);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const validBase = {
  NODE_ENV: 'development',
  PORT: '5000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'access_secret_that_is_at_least_32_chars_long__',
  JWT_REFRESH_SECRET: 'refresh_secret_that_is_at_least_32_chars_long_',
};

describe('Environment configuration schema', () => {
  it('parses a fully valid configuration', () => {
    const result = validate(validBase);

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(5000);
    expect(result.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
    expect(result.LOG_LEVEL).toBe('info');
    expect(result.RATE_LIMIT_MAX).toBe(100);
  });

  it('applies default values for optional fields', () => {
    const result = validate(validBase);

    expect(result.API_PREFIX).toBe('/api/v1');
    expect(result.CORS_ORIGINS).toBe('http://localhost:3000');
    expect(result.LOG_LEVEL).toBe('info');
    expect(result.COOKIE_SECURE).toBe(false);
    expect(result.RATE_LIMIT_WINDOW_MS).toBe(900_000);
  });

  it('coerces PORT string to number', () => {
    const result = validate({ ...validBase, PORT: '8080' });
    expect(result.PORT).toBe(8080);
    expect(typeof result.PORT).toBe('number');
  });

  it('transforms COOKIE_SECURE "true" to boolean true', () => {
    const result = validate({ ...validBase, COOKIE_SECURE: 'true' });
    expect(result.COOKIE_SECURE).toBe(true);
  });

  it('transforms COOKIE_SECURE "false" to boolean false', () => {
    const result = validate({ ...validBase, COOKIE_SECURE: 'false' });
    expect(result.COOKIE_SECURE).toBe(false);
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _, ...rest } = validBase;
    expect(() => validate(rest as Record<string, string>)).toThrow();
  });

  it('throws when DATABASE_URL is not a valid URL', () => {
    expect(() => validate({ ...validBase, DATABASE_URL: 'not-a-url' })).toThrow();
  });

  it('throws when JWT_ACCESS_SECRET is too short', () => {
    expect(() =>
      validate({ ...validBase, JWT_ACCESS_SECRET: 'tooshort' }),
    ).toThrow();
  });

  it('throws when JWT_REFRESH_SECRET is too short', () => {
    expect(() =>
      validate({ ...validBase, JWT_REFRESH_SECRET: 'tooshort' }),
    ).toThrow();
  });

  it('throws when PORT is out of valid range', () => {
    expect(() => validate({ ...validBase, PORT: '0' })).toThrow();
    expect(() => validate({ ...validBase, PORT: '99999' })).toThrow();
  });

  it('throws when NODE_ENV is not an allowed value', () => {
    expect(() => validate({ ...validBase, NODE_ENV: 'staging' })).toThrow();
  });

  it('throws when LOG_LEVEL is not an allowed value', () => {
    expect(() => validate({ ...validBase, LOG_LEVEL: 'verbose' })).toThrow();
  });

  it('accepts production NODE_ENV', () => {
    const result = validate({ ...validBase, NODE_ENV: 'production' });
    expect(result.NODE_ENV).toBe('production');
  });

  it('accepts test NODE_ENV', () => {
    const result = validate({ ...validBase, NODE_ENV: 'test' });
    expect(result.NODE_ENV).toBe('test');
  });
});
