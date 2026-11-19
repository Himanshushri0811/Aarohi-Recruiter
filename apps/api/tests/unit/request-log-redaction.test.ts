import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { describe, expect, it } from 'vitest';
import { redactSensitiveUrl, sanitizeSerializedRequest } from '../../src/config/logger.js';

describe('request log credential redaction', () => {
  it('redacts invitation tokens while retaining the useful request path and query', () => {
    const token = 'a'.repeat(64);
    const url = `/api/v1/interview/${token}/answer?retry=1`;

    expect(redactSensitiveUrl(url)).toBe('/api/v1/interview/[REDACTED]/answer?retry=1');
  });

  it('sanitizes the serialized request URL and preserves request metadata', () => {
    const serialized = sanitizeSerializedRequest({
      id: 'request-123',
      method: 'POST',
      url: `/api/v1/interview/${'b'.repeat(64)}/answer`,
      headers: {},
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      params: { token: 'b'.repeat(64) },
      query: { access_token: 'b'.repeat(64), page: '2' },
      raw: new IncomingMessage(new Socket()),
    });

    expect(serialized.url).toBe('/api/v1/interview/[REDACTED]/answer');
    expect(serialized.params.token).toBe('[REDACTED]');
    expect(serialized.query.access_token).toBe('[REDACTED]');
    expect(serialized.query.page).toBe('2');
    expect(serialized.method).toBe('POST');
    expect(serialized.id).toBe('request-123');
  });
});
