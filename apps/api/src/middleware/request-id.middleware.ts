import { Request, Response, NextFunction } from 'express';
import { RequestWithId } from '../common/types/index.js';

// ---------------------------------------------------------------------------
// Request ID middleware
// Assigns a unique UUID v4 to every inbound request.
// Attaches it to req.requestId and sets X-Request-ID response header.
// ---------------------------------------------------------------------------

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const existingId = req.headers['x-request-id'];
  const requestId =
    typeof existingId === 'string' && existingId.length > 0
      ? existingId
      : crypto.randomUUID();

  (req as RequestWithId).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}
