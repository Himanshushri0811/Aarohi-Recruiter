import { getPrismaClient } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { slugify } from '../../common/utils/helpers.js';
import { createAuditLog } from '../audit/audit.service.js';
import { CreateOrgInput, UpdateOrgInput } from './organizations.schemas.js';

export async function createOrganization(
  userId: string,
  input: CreateOrgInput,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const prisma = getPrismaClient();

  const finalSlug = (input.slug || slugify(input.name)).toLowerCase();
  if (!finalSlug) {
    throw AppError.badRequest('Unable to derive a valid organization slug from the provided name');
  }

  const existingOrg = await prisma.organization.findUnique({
    where: { slug: finalSlug },
  });

  if (existingOrg) {
    throw AppError.conflict('An organization with this slug already exists');
  }

  // Atomically create organization and assign creator as OWNER
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug: finalSlug,
        status: 'ACTIVE',
      },
    });

    const membership = await tx.membership.create({
      data: {
        userId,
        organizationId: org.id,
        role: 'OWNER',
        acceptedAt: new Date(),
      },
    });

    return { org, membership };
  });

  await createAuditLog({
    userId,
    organizationId: result.org.id,
    action: 'org.created',
    entityType: 'Organization',
    entityId: result.org.id,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    ...result.org,
    role: result.membership.role,
  };
}

export async function listUserOrganizations(userId: string) {
  const prisma = getPrismaClient();

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      organization: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return memberships.map((m) => ({
    ...m.organization,
    role: m.role,
  }));
}

export async function getOrganization(orgId: string, userId: string) {
  const prisma = getPrismaClient();

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: orgId,
      },
    },
    include: {
      organization: true,
    },
  });

  if (!membership) {
    throw AppError.forbidden('Access denied: You are not a member of this organization');
  }

  return {
    ...membership.organization,
    role: membership.role,
  };
}

export async function updateOrganization(
  orgId: string,
  userId: string,
  input: UpdateOrgInput,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const prisma = getPrismaClient();

  // Validate membership
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: orgId,
      },
    },
  });

  if (!membership) {
    throw AppError.forbidden('Access denied: You are not a member of this organization');
  }

  const updatedOrg = await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.settings ? { settings: input.settings as any } : {}),
    },
  });

  await createAuditLog({
    userId,
    organizationId: orgId,
    action: 'org.updated',
    entityType: 'Organization',
    entityId: orgId,
    metadata: { fields: Object.keys(input) },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    ...updatedOrg,
    role: membership.role,
  };
}
