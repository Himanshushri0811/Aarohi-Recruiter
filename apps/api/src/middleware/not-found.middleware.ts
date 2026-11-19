import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/app-error.js';
import { redactSensitiveUrl } from '../config/logger.js';

// ---------------------------------------------------------------------------
// 404 Not Found handler
// Registered after all routes. Throws AppError so the error handler formats it.
// ---------------------------------------------------------------------------

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route not found: ${req.method} ${redactSensitiveUrl(req.originalUrl)}`));
}
