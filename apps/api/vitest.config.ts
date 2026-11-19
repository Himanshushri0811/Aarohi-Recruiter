import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10_000,
    hookTimeout: 10_000,
    clearMocks: true,
    restoreMocks: true,
    env: {
      NODE_ENV: 'test',
      PORT: '5001',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
      JWT_ACCESS_SECRET: 'test_access_secret_at_least_32_characters_long__',
      JWT_REFRESH_SECRET: 'test_refresh_secret_at_least_32_characters_long_',
      CORS_ORIGINS: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
      APP_URL: 'http://localhost:3000',
      EMAIL_VERIFICATION_REQUIRED: 'true',
      AI_SERVICE_SECRET: 'shared_test_service_secret_for_node_fastapi_hmac_32_chars',
    },
    // Run test files in a consistent order
    sequence: {
      shuffle: false,
    },
  },
});
