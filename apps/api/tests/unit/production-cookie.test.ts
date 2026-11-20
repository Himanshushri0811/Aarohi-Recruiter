import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('production refresh cookie configuration', () => {
  it('uses secure cross-site cookies for the deployed Vercel frontend', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', 'postgresql://db.example.com:5432/aarohi');
    vi.stubEnv('JWT_ACCESS_SECRET', 'a-production-access-secret-with-more-than-32-characters');
    vi.stubEnv('JWT_REFRESH_SECRET', 'a-different-production-refresh-secret-over-32-characters');
    vi.stubEnv('AI_SERVICE_SECRET', 'a-shared-service-secret-with-more-than-32-characters');
    vi.stubEnv('CORS_ORIGINS', 'https://aarohi-recruiter-camd.vercel.app');
    vi.stubEnv('APP_URL', 'https://aarohi-recruiter-camd.vercel.app');
    vi.stubEnv('AI_SERVICE_URL', 'https://aarohi-recruiter-1.onrender.com');
    vi.stubEnv('COOKIE_SECURE', 'true');
    vi.stubEnv('EMAIL_PROVIDER', 'smtp');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('EMAIL_FROM', 'verified-sender@example.com');
    vi.resetModules();

    const { getRefreshCookieOptions } = await import(
      '../../src/modules/auth/auth.controller.js'
    );

    expect(getRefreshCookieOptions()).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/api/v1/auth',
    });
  });
});
