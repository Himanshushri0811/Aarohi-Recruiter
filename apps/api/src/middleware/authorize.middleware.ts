import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/app-error.js';
import { getPrismaClient } from '../config/database.js';
import { Permission, hasPermission } from '../modules/rbac/permissions.js';
import { AuthenticatedRequest } from '../common/types/index.js';

export function authorize(...requiredPermissions: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user || !authReq.user.sub) {
      return next(AppError.unauthorized('Authentication required'));
    }

    // Determine organization ID from route params, body, query, or headers
    const organizationId =
      req.params.orgId ||
      req.params.organizationId ||
      (req.body?.organizationId as string) ||
      (req.query?.organizationId as string) ||
      (req.headers['x-organization-id'] as string) ||
      authReq.user.organizationId;

    if (!organizationId) {
      return next(AppError.badRequest('Organization context is required'));
    }

    try {
      const prisma = getPrismaClient();

      // Enforce strict tenant isolation via database membership check
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: authReq.user.sub,
            organizationId,
          },
        },
        include: {
          organization: true,
        },
      });

      if (!membership) {
        return next(
          AppError.forbidden('Access denied: You are not a member of this organization'),
        );
      }

      if (membership.organization.status !== 'ACTIVE') {
        return next(
          AppError.forbidden('Organization is currently inactive or suspended'),
        );
      }

      // Attach resolved tenant context and role to request
      authReq.tenant = {
        organizationId: membership.organizationId,
        organizationSlug: membership.organization.slug,
      };
      authReq.user.role = membership.role;
      authReq.user.organizationId = membership.organizationId;

      // Check all required permissions
      for (const permission of requiredPermissions) {
        if (!hasPermission(membership.role, permission)) {
          return next(
            AppError.forbidden(
              `Forbidden: Role '${membership.role}' lacks required permission '${permission}'`,
            ),
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireSuperAdmin() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user || authReq.user.role !== 'SUPER_ADMIN') {
      return next(AppError.forbidden('Access denied: Super Admin privileges required'));
    }
    next();
  };
}
