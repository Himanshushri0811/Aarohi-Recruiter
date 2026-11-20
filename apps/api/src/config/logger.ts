import pino from 'pino';
import { env, type Env } from './env.js';

// ---------------------------------------------------------------------------
// Pino structured logger
// ---------------------------------------------------------------------------

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.passwordHash',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.refreshToken',
  '*.secret',
  '*.token',
  '*.password',
  '*.passwordHash',
];

const developmentTransport: pino.TransportSingleOptions = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
    messageFormat: '{msg}',
    errorLikeObjectKeys: ['err', 'error'],
  },
};

export function createLoggerOptions(nodeEnv: Env['NODE_ENV']): pino.LoggerOptions {
  return {
    name: 'ai-recruiter-api',
    level: env.LOG_LEVEL,
    redact: {
      paths: REDACTED_PATHS,
      censor: '[REDACTED]',
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
    ...(nodeEnv === 'development' ? { transport: developmentTransport } : {}),
  };
}

export const logger = pino(createLoggerOptions(env.NODE_ENV));

export function redactSensitiveUrl(url: string): string {
  return url.replace(/[a-f0-9]{64}/gi, '[REDACTED]');
}

export function sanitizeSerializedRequest(request: pino.SerializedRequest): pino.SerializedRequest {
  return {
    ...request,
    url: redactSensitiveUrl(request.url),
    params: sanitizeRequestValues(request.params),
    query: sanitizeRequestValues(request.query),
  };
}

function sanitizeRequestValues(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      /token/i.test(key) ? '[REDACTED]' : redactSensitiveUrl(value),
    ]),
  );
}

export type Logger = typeof logger;
