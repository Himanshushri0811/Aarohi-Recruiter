import { Request, Response, NextFunction, RequestHandler } from 'express';

// ---------------------------------------------------------------------------
// asyncHandler — eliminates try/catch boilerplate in route handlers.
// Wraps an async Express handler and forwards any rejection to next().
// ---------------------------------------------------------------------------

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void | Response>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
