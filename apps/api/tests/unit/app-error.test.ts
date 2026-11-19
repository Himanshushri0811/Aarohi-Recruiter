// Unit tests: AppError class
// Verifies correct HTTP status codes, error codes, serialisation, and factory methods.

import { describe, it, expect } from 'vitest';
import { AppError } from '../../src/common/errors/app-error.js';

describe('AppError', () => {
  describe('constructor', () => {
    it('stores statusCode, code, message and isOperational', () => {
      const err = new AppError('Something broke', 500, 'INTERNAL_ERROR', undefined, false);

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.message).toBe('Something broke');
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
      expect(err.isOperational).toBe(false);
    });

    it('stores optional details array', () => {
      const details = [{ field: 'email', message: 'Invalid email format' }];
      const err = new AppError('Bad request', 400, 'BAD_REQUEST', details);
      expect(err.details).toEqual(details);
    });

    it('defaults isOperational to true', () => {
      const err = new AppError('Not found', 404, 'NOT_FOUND');
      expect(err.isOperational).toBe(true);
    });

    it('sets the name property to AppError', () => {
      const err = AppError.badRequest();
      expect(err.name).toBe('AppError');
    });

    it('captures a stack trace', () => {
      const err = AppError.internal();
      expect(err.stack).toBeDefined();
    });
  });

  describe('static factory methods', () => {
    it('notFound() returns 404 NOT_FOUND', () => {
      const err = AppError.notFound();
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    });

    it('notFound() uses custom message', () => {
      const err = AppError.notFound('User not found');
      expect(err.message).toBe('User not found');
    });

    it('unauthorized() returns 401 UNAUTHORIZED', () => {
      const err = AppError.unauthorized();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
    });

    it('forbidden() returns 403 FORBIDDEN', () => {
      const err = AppError.forbidden();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    });

    it('emailNotVerified() returns 403 EMAIL_NOT_VERIFIED', () => {
      const err = AppError.emailNotVerified();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('EMAIL_NOT_VERIFIED');
      expect(err.message).toBe('Please verify your email address before logging in');
    });

    it('badRequest() returns 400 BAD_REQUEST', () => {
      const err = AppError.badRequest();
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('BAD_REQUEST');
    });

    it('conflict() returns 409 CONFLICT', () => {
      const err = AppError.conflict();
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
    });

    it('unprocessable() returns 422 UNPROCESSABLE_ENTITY', () => {
      const err = AppError.unprocessable();
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('rateLimited() returns 429 RATE_LIMITED', () => {
      const err = AppError.rateLimited();
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe('RATE_LIMITED');
    });

    it('internal() returns 500 INTERNAL_ERROR with isOperational=false', () => {
      const err = AppError.internal();
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
      expect(err.isOperational).toBe(false);
    });

    it('serviceUnavailable() returns 503', () => {
      const err = AppError.serviceUnavailable();
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('toJSON()', () => {
    it('returns standard error envelope without requestId', () => {
      const err = AppError.notFound('Thing not found');
      const json = err.toJSON() as Record<string, unknown>;

      expect(json).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Thing not found',
        },
      });
      // No requestId when not provided
      expect((json.error as Record<string, unknown>).requestId).toBeUndefined();
    });

    it('includes requestId when provided', () => {
      const err = AppError.badRequest();
      const json = err.toJSON('req-123') as { error: Record<string, unknown> };
      expect(json.error.requestId).toBe('req-123');
    });

    it('includes details when present', () => {
      const details = [{ field: 'email', message: 'Required' }];
      const err = AppError.unprocessable('Validation failed', details);
      const json = err.toJSON() as { error: Record<string, unknown> };
      expect(json.error.details).toEqual(details);
    });

    it('omits details when not present', () => {
      const err = AppError.notFound();
      const json = err.toJSON() as { error: Record<string, unknown> };
      expect(json.error.details).toBeUndefined();
    });
  });
});
