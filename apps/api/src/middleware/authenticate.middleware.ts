import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/app-error.js';
import { verifyAccessToken } from '../modules/auth/auth.service.js';
import { AuthenticatedRequest, AuthPayload } from '../common/types/index.js';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Authentication required: Missing or invalid Authorization header'));
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next(AppError.unauthorized('Authentication required: Token is empty'));
  }

  try {
    const payload = await verifyAccessToken(token);
    (req as AuthenticatedRequest).user = {
      sub: payload.sub as string,
      email: payload.email as string,
      organizationId: payload.organizationId as string | undefined,
      role: payload.role as string | undefined,
      iat: payload.iat,
      exp: payload.exp,
    } as AuthPayload;

    next();
  } catch (error) {
    next(error);
  }
}
