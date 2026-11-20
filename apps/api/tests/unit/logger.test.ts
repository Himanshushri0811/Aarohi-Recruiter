import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createLoggerOptions } from '../../src/config/logger.js';

describe('logger configuration', () => {
  it('initializes production logging without pino-pretty and redacts sensitive fields', () => {
    const output: string[] = [];
    const logger = pino(
      { ...createLoggerOptions('production'), level: 'info' },
      { write: (message) => output.push(message) },
    );

    logger.info(
      {
        req: {
          headers: { authorization: 'Bearer access-token', cookie: 'session=secret' },
          body: {
            password: 'password',
            passwordHash: 'password-hash',
            currentPassword: 'current-password',
            newPassword: 'new-password',
            token: 'request-token',
            refreshToken: 'refresh-token',
          },
        },
        user: { secret: 'secret', token: 'token', password: 'password', passwordHash: 'hash' },
      },
      'startup',
    );

    expect(createLoggerOptions('production')).not.toHaveProperty('transport');
    const logged = JSON.parse(output[0]);
    expect(logged.req.headers).toEqual({
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
    });
    expect(logged.req.body).toEqual({
      password: '[REDACTED]',
      passwordHash: '[REDACTED]',
      currentPassword: '[REDACTED]',
      newPassword: '[REDACTED]',
      token: '[REDACTED]',
      refreshToken: '[REDACTED]',
    });
    expect(logged.user).toEqual({
      secret: '[REDACTED]',
      token: '[REDACTED]',
      password: '[REDACTED]',
      passwordHash: '[REDACTED]',
    });
  });

  it('retains the pretty transport in development', () => {
    expect(createLoggerOptions('development').transport).toMatchObject({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
        errorLikeObjectKeys: ['err', 'error'],
      },
    });
  });
});
