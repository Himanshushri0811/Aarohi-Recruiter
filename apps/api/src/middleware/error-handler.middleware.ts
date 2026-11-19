import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../common/errors/app-error.js';
import { RequestWithId } from '../common/types/index.js';
import { logger } from '../config/logger.js';
import { isProduction } from '../config/env.js';

// ---------------------------------------------------------------------------
// Centralised Express error handler (must have 4 arguments)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as RequestWithId).requestId;

  // ---- Zod validation errors from route handlers ----
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
    const appError = AppError.unprocessable('Request validation failed', details);

    logger.warn({ requestId, err: appError }, 'Validation error');

    res.status(422).json(appError.toJSON(requestId));
    return;
  }

  // ---- Known operational errors ----
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ requestId, err }, err.message);
    } else {
      logger.warn({ requestId, statusCode: err.statusCode, code: err.code }, err.message);
    }

    res.status(err.statusCode).json(err.toJSON(requestId));
    return;
  }

  // ---- Unknown / unexpected errors ----
  const unknownErr = err instanceof Error ? err : new Error(String(err));
  logger.error({ requestId, err: unknownErr }, 'Unexpected error');

  const internalError = AppError.internal();
  const body = internalError.toJSON(requestId);

  // Expose stack trace only in non-production for debugging
  if (!isProduction() && unknownErr.stack) {
    (body as Record<string, unknown>).stack = unknownErr.stack;
  }

  res.status(500).json(body);
}
