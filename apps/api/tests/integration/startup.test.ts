// Integration tests: Application startup and middleware wiring
// All tests run fully in-process — no TCP connections.

import { describe, it, expect, beforeAll } from 'vitest';
import type { Application } from 'express';

// Set up env before imports
process.env.NODE_ENV = 'test';
process.env.PORT = '5002';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_ACCESS_SECRET = 'startup_test_access_secret_at_least_32_chars_ok';
process.env.JWT_REFRESH_SECRET = 'startup_test_refresh_secret_at_least_32_chars_ok';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';

// ---------------------------------------------------------------------------
// Minimal in-process Express driver (no TCP, no network)
// ---------------------------------------------------------------------------

import { Readable, Writable } from 'stream';

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
  bodyPayload?: string,
): Promise<MockResponse> {
  return new Promise((resolve) => {
    const req = Object.assign(
      new Readable({
        read() {
          if (bodyPayload) this.push(bodyPayload);
          this.push(null);
        },
      }),
      {
        method,
        url: path,
        headers: {
          host: 'localhost',
          'content-type': bodyPayload ? 'application/json' : undefined,
          ...reqHeaders,
        },
        socket: { remoteAddress: '127.0.0.1' },
        connection: { remoteAddress: '127.0.0.1' },
        httpVersion: '1.1',
        httpVersionMajor: 1,
        httpVersionMinor: 1,
        complete: true,
        readable: true,
        trailers: {},
        rawHeaders: [],
        aborted: false,
        destroy: () => {},
      },
    );

    const resHeaders: Record<string, string | string[]> = {};
    let statusCode = 200;
    const chunks: Buffer[] = [];

    const resolveWith = (data?: string | Buffer | unknown) => {
      if (data instanceof Buffer) chunks.push(data);
      else if (typeof data === 'string') chunks.push(Buffer.from(data));
      else if (data !== undefined) chunks.push(Buffer.from(JSON.stringify(data)));
      const raw = Buffer.concat(chunks).toString();
      let parsed: unknown = raw;
      try { parsed = JSON.parse(raw); } catch { /* keep string */ }
      resolve({ status: statusCode, headers: resHeaders, body: parsed });
    };

    const res = Object.assign(new Writable({ write(c: Buffer, _e, cb) { chunks.push(c); cb(); } }), {
      statusCode: 200,
      headersSent: false,
      locals: {},
      app,
      req,
      setHeader: (n: string, v: string | string[]) => { resHeaders[n.toLowerCase()] = v; },
      getHeader: (n: string) => resHeaders[n.toLowerCase()],
      removeHeader: (n: string) => { delete resHeaders[n.toLowerCase()]; },
      hasHeader: (n: string) => n.toLowerCase() in resHeaders,
      writeHead: (code: number, hdrs?: Record<string, string>) => {
        statusCode = code;
        if (hdrs) Object.entries(hdrs).forEach(([k, v]) => { resHeaders[k.toLowerCase()] = v; });
      },
      status(code: number) {
        statusCode = code;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (res as any).statusCode = code;
        return res;
      },
      json: (data: unknown) => {
        resHeaders['content-type'] = 'application/json; charset=utf-8';
        resolveWith(data);
      },
      send: (data: unknown) => resolveWith(data),
      end: (data?: string | Buffer) => resolveWith(data),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).handle(req, res, () => resolve({ status: 404, headers: {}, body: null }));
  });
}

// ---------------------------------------------------------------------------

let app: Application;

beforeAll(async () => {
  const { createApp } = await import('../../src/app.js');
  app = createApp();
});

describe('Application startup', () => {
  it('creates the Express app without throwing', () => {
    expect(app).toBeDefined();
  });

  it('trust proxy is configured', () => {
    expect(app.get('trust proxy')).toBeTruthy();
  });

  it('x-powered-by is disabled', () => {
    expect(app.get('x-powered-by')).toBeFalsy();
  });
});

describe('Request ID middleware', () => {
  it('assigns X-Request-ID on every response', async () => {
    const res = await inProcess(app, 'GET', '/api/v1/health/live');
    const rid = res.headers['x-request-id'] as string;
    expect(rid).toBeDefined();
    expect(rid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('two requests get different IDs', async () => {
    const r1 = await inProcess(app, 'GET', '/api/v1/health/live');
    const r2 = await inProcess(app, 'GET', '/api/v1/health/live');
    expect(r1.headers['x-request-id']).not.toBe(r2.headers['x-request-id']);
  });
});

describe('JSON parsing middleware', () => {
  it('processes POST with JSON body without crashing', async () => {
    const res = await inProcess(
      app, 'POST', '/api/v1/nonexistent',
      { 'content-type': 'application/json' },
      JSON.stringify({ test: true }),
    );
    // 404 means body was accepted, not rejected with a parse error
    expect(res.status).toBe(404);
  });
});

describe('Error handler format', () => {
  it('always sets content-type to application/json for error responses', async () => {
    const res = await inProcess(app, 'GET', '/api/v1/does-not-exist');
    const ct = res.headers['content-type'] as string;
    expect(ct).toMatch(/application\/json/);
  });

  it('error responses always include success:false with error.code and error.message', async () => {
    const res = await inProcess(app, 'GET', '/api/v1/does-not-exist');
    const body = res.body as { success: boolean; error: { code: string; message: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBeDefined();
    expect(body.error.message).toBeDefined();
  });
});
