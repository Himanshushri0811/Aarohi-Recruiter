// Setup test environment before module imports
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_at_least_32_characters_long__';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_characters_long_';
process.env.LOG_LEVEL = 'silent';

import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateRawToken,
  generateAccessToken,
  verifyAccessToken,
} from '../../src/modules/auth/auth.service.js';

describe('Auth Service - Cryptographic & Token Operations', () => {
  describe('Password Hashing & Verification with Argon2id', () => {
    it('hashes passwords with argon2id and verifies correctly', async () => {
      const password = 'SuperSecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$argon2id\$/);

      const isValid = await verifyPassword(hash, password);
      expect(isValid).toBe(true);
    });

    it('rejects incorrect password verification', async () => {
      const password = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword456!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(hash, wrongPassword);
      expect(isValid).toBe(false);
    });

    it('generates unique hashes for identical passwords due to salt', async () => {
      const password = 'SamePassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(await verifyPassword(hash1, password)).toBe(true);
      expect(await verifyPassword(hash2, password)).toBe(true);
    });

    it('gracefully handles malformed hash strings without throwing', async () => {
      const isValid = await verifyPassword('not-a-valid-argon-hash', 'password');
      expect(isValid).toBe(false);
    });
  });

  describe('Token Hashing & Random Generation', () => {
    it('hashes tokens deterministically with SHA-256', () => {
      const token = 'sample-verification-token-string';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // 256 bits = 64 hex characters
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates high-entropy random base64url tokens', () => {
      const token1 = generateRawToken();
      const token2 = generateRawToken();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThanOrEqual(48);
    });
  });

  describe('JWT Access Token Lifecycle', () => {
    it('generates and verifies valid access tokens with expected claims', async () => {
      const payload = {
        sub: 'usr_123456789',
        email: 'recruiter@aarohi.test',
        organizationId: 'org_987654321',
        role: 'RECRUITER',
      };

      const token = await generateAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded = await verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.organizationId).toBe(payload.organizationId);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.iss).toBe('aarohi-api');
      expect(decoded.aud).toBe('aarohi-web');
      expect(decoded.exp).toBeDefined();
    });

    it('rejects tampered or forged JWT tokens', async () => {
      const payload = { sub: 'usr_123', email: 'test@aarohi.test' };
      const validToken = await generateAccessToken(payload);

      // Tamper with the payload part
      const parts = validToken.split('.');
      parts[1] = Buffer.from(JSON.stringify({ sub: 'hacker' })).toString('base64url');
      const tamperedToken = parts.join('.');

      await expect(verifyAccessToken(tamperedToken)).rejects.toThrow(
        'Invalid, expired, or malformed access token',
      );
    });
  });
});
