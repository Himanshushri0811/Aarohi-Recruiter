import express from 'express';
import type { Application } from 'express';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'http';
import type { ServerResponse } from 'http';
import { logger, sanitizeSerializedRequest } from './config/logger.js';
import { env } from './config/env.js';
import { applySecurityMiddleware } from './middleware/security.middleware.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { errorHandlerMiddleware } from './middleware/error-handler.middleware.js';
import { notFoundMiddleware } from './middleware/not-found.middleware.js';
import { mountRoutes } from './routes/index.js';

// ---------------------------------------------------------------------------
// Application factory — creates and configures the Express app.
// Separated from server.ts to allow clean testing without port binding.
// ---------------------------------------------------------------------------

export function createApp(): Application {
  const app = express();

  // Trust proxy for accurate IP logging behind load balancers
  app.set('trust proxy', 1);

  // Disable Express version fingerprinting
  app.disable('x-powered-by');

  // 1. Security headers, CORS, body parsers, rate limiting
  applySecurityMiddleware(app);

  // 2. HTTP request logging (pino-http)
  app.use(
    pinoHttp({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: logger as any,
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url?.includes('/health') ?? false,
      },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '[REDACTED]',
      },
      serializers: {
        req: sanitizeSerializedRequest,
      },
      customLogLevel: (
        _req: IncomingMessage,
        res: ServerResponse,
        err: Error | undefined,
      ): string => {
        if (err ?? res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // 3. Request ID (after logging so pino-http doesn't miss it)
  app.use(requestIdMiddleware);

  // 4. API routes
  mountRoutes(app);

  // 5. 404 handler (after all routes)
  app.use(notFoundMiddleware);

  // 6. Centralised error handler (must be last, 4-arg signature)
  app.use(errorHandlerMiddleware);

  return app;
}

// Package version — read once at startup
export const API_VERSION = env.API_PREFIX;
