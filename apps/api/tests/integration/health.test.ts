// Integration tests: Health endpoints
// Tests the route handler logic and middleware chain fully in-process.
// The sandbox restricts all TCP connections, so we call the Express app
// handler directly by emulating req/res using Node's stream primitives.

import { describe, it, expect, beforeAll } from 'vitest';

// Set up environment variables before any module imports
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_at_least_32_characters_long__';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_characters_long_';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';

// ---------------------------------------------------------------------------
// In-process mock — drives the Express middleware stack without TCP
// ---------------------------------------------------------------------------

import { EventEmitter, Readable, Writable } from 'stream';
import type { Application } from 'express';

interface MockResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: unknown;
}

function inProcess(
  app: Application,
  method: string,
  path: string,
  reqHeaders: Record<string, string> = {},
): Promise<MockResponse> {
  return new Promise((resolve) => {
    // Build a minimal IncomingMessage-compatible object
    const req = new Readable({
      read() {
        this.push(null);
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    Object.assign(req, {
      method,
      url: path,
      headers: { host: 'localhost', ...reqHeaders },
      socket: { remoteAddress: '127.0.0.1' },
      connection: { remoteAddress: '127.0.0.1' },
      httpVersion: '1.1',
      httpVersionMajor: 1,
      httpVersionMinor: 1,
      complete: true,
      readable: true,
      trailers: {},
      rawTrailers: [],
      rawHeaders: [],
      aborted: false,
      destroy: () => {},
    });

    // Build a minimal ServerResponse-compatible object
    const resHeaders: Record<string, string | string[]> = {};
    let statusCode = 200;
    const chunks: Buffer[] = [];

    const res = new Writable({
      write(chunk: Buffer, _enc, cb) {
        chunks.push(chunk);
        cb();
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    Object.assign(res, {
      statusCode: 200,
      headersSent: false,
      locals: {},
      app,
      req,
      setHeader(name: string, value: string | string[]) {
        resHeaders[name.toLowerCase()] = value;
      },
      getHeader(name: string) {
        return resHeaders[name.toLowerCase()];
      },
      removeHeader(name: string) {
        delete resHeaders[name.toLowerCase()];
      },
      hasHeader(name: string) {
        return name.toLowerCase() in resHeaders;
      },
      writeHead(code: number, hdrs?: Record<string, string>) {
        statusCode = code;
        if (hdrs) Object.entries(hdrs).forEach(([k, v]) => { resHeaders[k.toLowerCase()] = v; });
      },
      end(data?: string | Buffer) {
        if (data) chunks.push(typeof data === 'string' ? Buffer.from(data) : data);
        const body = Buffer.concat(chunks).toString();
        let parsed: unknown = body;
        try { parsed = JSON.parse(body); } catch { /* keep raw string */ }
        resolve({ status: statusCode, headers: resHeaders, body: parsed });
      },
      json(data: unknown) {
        resHeaders['content-type'] = 'application/json';
        const str = JSON.stringify(data);
        chunks.push(Buffer.from(str));
        const body = data;
        resolve({ status: statusCode, headers: resHeaders, body });
      },
      send(data: unknown) {
        if (typeof data === 'string') chunks.push(Buffer.from(data));
        else if (Buffer.isBuffer(data)) chunks.push(data);
        else { resHeaders['content-type'] = 'application/json'; chunks.push(Buffer.from(JSON.stringify(data))); }
        const rawBody = Buffer.concat(chunks).toString();
        let parsed: unknown = rawBody;
        try { parsed = JSON.parse(rawBody); } catch { /* keep raw */ }
        resolve({ status: statusCode, headers: resHeaders, body: parsed });
      },
      status(code: number) {
        statusCode = code;
        (res as Record<string, unknown>).statusCode = code;
        return res;
      },
      on: EventEmitter.prototype.on,
      once: EventEmitter.prototype.once,
      emit: EventEmitter.prototype.emit,
      removeListener: EventEmitter.prototype.removeListener,
      write(chunk: Buffer | string, _enc?: unknown, cb?: () => void) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        if (typeof cb === 'function') cb();
        return true;
      },
    });

    // Let Express handle the request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).handle(req, res, () => {
      resolve({ status: 404, headers: {}, body: null });
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let app: Application;

beforeAll(async () => {
  const { createApp } = await import('../../src/app.js');
  app = createApp();
});

describe('GET /api/v1/health/live', () => {
  it('responds 200 with status:alive', async () => {
    const res = await inProcess(app, 'GET', '/api/v1/health/live');

    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: { status: string; service: string; timestamp: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('alive');
    expect(body.data.service).toBe('ai-recruiter-api');
    expect(body.data.timestamp).toBeDefined();
  });

  it('sets X-Request-ID response header', async () => {
    const res = await inProcess(app, 'GET', '/api/v1/health/live');
    const rid = res.headers['x-request-id'] as string;
    expect(rid).toBeDefined();
    expect(rid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('propagates upstream X-Request-ID', async () => {
    const myId = 'upstream-trace-id-abc-123';
    const res = await inProcess(app, 'GET', '/api/v1/health/live', { 'x-request-id': myId });
    expect(res.headers['x-request-id']).toBe(myId);
  });

  it('does NOT expose X-Powered-By header', async () => {
    const res = await inProcess(app, 'GET', '/api/v1/health/live');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('GET /api/v1/health/ready', () => {
  it('responds with a readiness envelope', async () => {
    const res = await inProcess(app, 'GET', '/api/v1/health/ready');
    expect([200, 503]).toContain(res.status);
    const body = res.body as { data: { status: string; checks: { database: { status: string; latencyMs: number } } } };
    expect(['ready', 'degraded']).toContain(body.data.status);
    expect(body.data.checks.database).toBeDefined();
  });

  it('reports database latencyMs', async () => {
    const res = await inProcess(app, 'GET', '/api/v1/health/ready');
    const body = res.body as { data: { checks: { database: { latencyMs: number } } } };
    expect(typeof body.data.checks.database.latencyMs).toBe('number');
  });

  it('database status is healthy or unhealthy', async () => {
    const res = await inProcess(app, 'GET', '/api/v1/health/ready');
    const body = res.body as { data: { checks: { database: { status: string } } } };
    expect(['healthy', 'unhealthy']).toContain(body.data.checks.database.status);
  });
});

describe('Unknown routes', () => {
  it('GET /api/v1/nonexistent returns 404 NOT_FOUND', async () => {
    const res = await inProcess(app, 'GET', '/api/v1/nonexistent');
    expect(res.status).toBe(404);
    const body = res.body as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('GET /completely/unknown returns 404', async () => {
    const res = await inProcess(app, 'GET', '/completely/unknown');
    expect(res.status).toBe(404);
    expect((res.body as { success: boolean }).success).toBe(false);
  });
});

describe('Error handler', () => {
  it('returns consistent error envelope for 404s', async () => {
    const res = await inProcess(app, 'GET', '/api/v1/does-not-exist');
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('not found'),
      },
    });
  });
});
