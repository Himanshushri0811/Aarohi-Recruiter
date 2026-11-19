import { getPrismaClient } from '../../config/database.js';
import { logger } from '../../config/logger.js';

export interface AuditLogParams {
  organizationId?: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const prisma = getPrismaClient();
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: (params.metadata as any) ?? {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (err) {
    logger.error(
      { err, params: { action: params.action, userId: params.userId } },
      'Failed to write audit log',
    );
  }
}
