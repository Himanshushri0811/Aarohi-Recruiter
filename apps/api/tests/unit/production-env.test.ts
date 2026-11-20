import { describe, expect, it } from 'vitest';
import {
  envSchema,
  PRODUCTION_AI_SERVICE_URL,
  PRODUCTION_FRONTEND_ORIGIN,
} from '../../src/config/env.js';

const productionConfig = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://db.example.com:5432/aarohi',
  JWT_ACCESS_SECRET: 'a-production-access-secret-with-more-than-32-characters',
  JWT_REFRESH_SECRET: 'a-different-production-refresh-secret-over-32-characters',
  AI_SERVICE_SECRET: 'a-shared-service-secret-with-more-than-32-characters',
  CORS_ORIGINS: PRODUCTION_FRONTEND_ORIGIN,
  APP_URL: PRODUCTION_FRONTEND_ORIGIN,
  AI_SERVICE_URL: PRODUCTION_AI_SERVICE_URL,
  COOKIE_SECURE: 'true',
  EMAIL_PROVIDER: 'smtp',
  SMTP_HOST: 'smtp.example.com',
  EMAIL_FROM: 'verified-sender@example.com',
};

describe('production environment validation', () => {
  it('accepts the configured production service origins and secure cookies', () => {
    const result = envSchema.safeParse(productionConfig);

    expect(result.success).toBe(true);
  });

  it('rejects localhost, wildcard, or additional origins in production', () => {
    for (const corsOrigins of [
      'http://localhost:3000',
      '*',
      `${PRODUCTION_FRONTEND_ORIGIN},https://untrusted.example`,
    ]) {
      const result = envSchema.safeParse({ ...productionConfig, CORS_ORIGINS: corsOrigins });
      expect(result.success).toBe(false);
    }
  });

  it('requires secure cookies and the deployed AI service URL in production', () => {
    expect(envSchema.safeParse({ ...productionConfig, COOKIE_SECURE: 'false' }).success).toBe(
      false,
    );
    expect(
      envSchema.safeParse({
        ...productionConfig,
        AI_SERVICE_URL: 'http://localhost:8000',
      }).success,
    ).toBe(false);
  });
});
