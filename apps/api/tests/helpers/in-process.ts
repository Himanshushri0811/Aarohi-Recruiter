import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';
import type { Application } from 'express';

export interface MockResponse<T = any> {
  status: number;
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: T;
}

export function inProcess<T = any>(
  app: Application,
  method: string,
  path: string,
  options: {
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<MockResponse<T>> {
  return new Promise((resolve) => {
    const rawHeaders: Record<string, string> = { host: 'localhost', ...(options.headers || {}) };
    let bodyBuffer: Buffer | null = null;

    if (options.body !== undefined) {
      if (typeof options.body === 'string') {
        bodyBuffer = Buffer.from(options.body);
      } else if (Buffer.isBuffer(options.body)) {
        bodyBuffer = options.body;
      } else {
        bodyBuffer = Buffer.from(JSON.stringify(options.body));
        if (!rawHeaders['content-type'] && !rawHeaders['Content-Type']) {
          rawHeaders['content-type'] = 'application/json';
        }
      }
      rawHeaders['content-length'] = String(bodyBuffer.length);
    }

    let hasPushed = false;
    const req = new Readable({
      read() {
        if (!hasPushed) {
          hasPushed = true;
          if (bodyBuffer) {
            this.push(bodyBuffer);
          }
          this.push(null);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    Object.assign(req, {
      method: method.toUpperCase(),
      url: path,
      headers: rawHeaders,
      socket: { remoteAddress: '127.0.0.1' },
      connection: { remoteAddress: '127.0.0.1' },
      httpVersion: '1.1',
      httpVersionMajor: 1,
      httpVersionMinor: 1,
      complete: true,
      readable: true,
      trailers: {},
      rawTrailers: [],
      rawHeaders: Object.entries(rawHeaders).flatMap(([k, v]) => [k, v]),
      aborted: false,
      destroy: () => {},
    });

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
        const lower = name.toLowerCase();
        if (lower === 'set-cookie') {
          const existing = resHeaders['set-cookie'];
          if (!existing) {
            resHeaders['set-cookie'] = Array.isArray(value) ? value : [value];
          } else if (Array.isArray(existing)) {
            if (Array.isArray(value)) {
              existing.push(...value);
            } else {
              existing.push(value);
            }
          } else {
            resHeaders['set-cookie'] = [existing as string, ...(Array.isArray(value) ? value : [value])];
          }
        } else {
          resHeaders[lower] = value;
        }
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
        if (hdrs) {
          Object.entries(hdrs).forEach(([k, v]) => {
            res.setHeader(k, v);
          });
        }
      },
      cookie(name: string, val: string, options: any = {}) {
        let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(val)}`;
        if (options.maxAge) cookieStr += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
        if (options.domain) cookieStr += `; Domain=${options.domain}`;
        if (options.path) cookieStr += `; Path=${options.path}`;
        if (options.expires) cookieStr += `; Expires=${options.expires.toUTCString()}`;
        if (options.httpOnly) cookieStr += '; HttpOnly';
        if (options.secure) cookieStr += '; Secure';
        if (options.sameSite) cookieStr += `; SameSite=${options.sameSite}`;
        res.setHeader('Set-Cookie', cookieStr);
      },
      clearCookie(name: string, options: any = {}) {
        res.cookie(name, '', { ...options, expires: new Date(1), maxAge: 0 });
      },
      end(data?: string | Buffer) {
        if (data) chunks.push(typeof data === 'string' ? Buffer.from(data) : data);
        const rawBody = Buffer.concat(chunks).toString();
        let parsed: unknown = rawBody;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          // raw string
        }
        resolve({
          status: statusCode,
          statusCode,
          headers: resHeaders,
          body: parsed as T,
        });
      },
      json(data: unknown) {
        resHeaders['content-type'] = 'application/json';
        const str = JSON.stringify(data);
        chunks.push(Buffer.from(str));
        resolve({
          status: statusCode,
          statusCode,
          headers: resHeaders,
          body: data as T,
        });
      },
      send(data: unknown) {
        if (typeof data === 'string') {
          chunks.push(Buffer.from(data));
        } else if (Buffer.isBuffer(data)) {
          chunks.push(data);
        } else {
          resHeaders['content-type'] = 'application/json';
          chunks.push(Buffer.from(JSON.stringify(data)));
        }
        const rawBody = Buffer.concat(chunks).toString();
        let parsed: unknown = rawBody;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          // raw
        }
        resolve({
          status: statusCode,
          statusCode,
          headers: resHeaders,
          body: parsed as T,
        });
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

    // Let Express handle the request in-process
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).handle(req, res, () => {
      resolve({ status: 404, statusCode: 404, headers: {}, body: null as unknown as T });
    });
  });
}
