// Unit tests: requestIdMiddleware
// Verifies UUID assignment, header propagation, and per-request uniqueness.

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from '../../src/middleware/request-id.middleware.js';
import type { RequestWithId } from '../../src/common/types/index.js';

// ---------------------------------------------------------------------------
// Helpers — minimal Express mock objects
// ---------------------------------------------------------------------------

function makeReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers } as Partial<Request>;
}

function makeRes(): { headers: Record<string, string>; setHeader: ReturnType<typeof vi.fn> } {
  const res = {
    headers: {} as Record<string, string>,
    setHeader: vi.fn(),
  };
  // Wire setHeader to store into headers for assertion convenience
  res.setHeader.mockImplementation((key: string, value: string) => {
    res.headers[key] = value;
  });
  return res;
}

const next: NextFunction = vi.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requestIdMiddleware', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('assigns a UUID requestId when no X-Request-ID header is present', () => {
    const req = makeReq();
    const res = makeRes();

    requestIdMiddleware(req as Request, res as unknown as Response, next);

    const id = (req as RequestWithId).requestId;
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    // UUID v4 pattern
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('sets the X-Request-ID response header', () => {
    const req = makeReq();
    const res = makeRes();

    requestIdMiddleware(req as Request, res as unknown as Response, next);

    const id = (req as RequestWithId).requestId;
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', id);
    // Also verify the value was stored
    expect(res.headers['X-Request-ID']).toBe(id);
  });

  it('calls next() after assigning requestId', () => {
    const req = makeReq();
    const res = makeRes();

    requestIdMiddleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('propagates an existing X-Request-ID from upstream header', () => {
    const existingId = 'upstream-trace-id-abc123';
    const req = makeReq({ 'x-request-id': existingId });
    const res = makeRes();

    requestIdMiddleware(req as Request, res as unknown as Response, next);

    expect((req as RequestWithId).requestId).toBe(existingId);
    expect(res.headers['X-Request-ID']).toBe(existingId);
  });

  it('generates a different requestId for each call', () => {
    const req1 = makeReq();
    const req2 = makeReq();
    const res1 = makeRes();
    const res2 = makeRes();

    requestIdMiddleware(req1 as Request, res1 as unknown as Response, next);
    requestIdMiddleware(req2 as Request, res2 as unknown as Response, next);

    const id1 = (req1 as RequestWithId).requestId;
    const id2 = (req2 as RequestWithId).requestId;

    expect(id1).not.toBe(id2);
  });
});
