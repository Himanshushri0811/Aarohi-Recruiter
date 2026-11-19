// ---------------------------------------------------------------------------
// Candidates service — CRUD operations scoped to an organization
// ---------------------------------------------------------------------------
import type { Candidate, Prisma } from '@prisma/client';
import { getPrismaClient } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import type { CreateCandidateInput, UpdateCandidateInput } from './candidates.schemas.js';

/**
 * Creates a new candidate within an organization.
 * Throws CONFLICT if the email is already registered in the same org.
 */
export async function createCandidate(
  orgId: string,
  input: CreateCandidateInput,
): Promise<Candidate> {
  const prisma = getPrismaClient();

  const existing = await prisma.candidate.findUnique({
    where: { organizationId_email: { organizationId: orgId, email: input.email } },
  });
  if (existing) {
    throw AppError.conflict(`A candidate with email "${input.email}" already exists in this organization`);
  }

  return prisma.candidate.create({
    data: {
      ...input,
      organizationId: orgId,
    },
  });
}

/**
 * Lists candidates for an organization with optional status/search filters.
 */
export async function listCandidates(
  orgId: string,
  filters?: { status?: string; search?: string },
): Promise<Candidate[]> {
  const prisma = getPrismaClient();

  const where: Prisma.CandidateWhereInput = { organizationId: orgId };

  if (filters?.status) {
    where.status = filters.status as Candidate['status'];
  }

  if (filters?.search) {
    const search = filters.search;
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { headline: { contains: search, mode: 'insensitive' } },
    ];
  }

  return prisma.candidate.findMany({
    where,
    include: {
      _count: {
        select: {
          resumes: true,
          applications: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  }) as unknown as Candidate[];
}

/**
 * Gets a single candidate by id, verifying org ownership.
 * Includes resumes and application count.
 * Throws NOT_FOUND if the candidate doesn't belong to the org.
 */
export async function getCandidate(
  orgId: string,
  candidateId: string,
): Promise<Candidate> {
  const prisma = getPrismaClient();

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: orgId },
    include: {
      resumes: { orderBy: { createdAt: 'desc' } },
      _count: { select: { applications: true } },
    },
  });

  if (!candidate) {
    throw AppError.notFound('Candidate not found');
  }

  return candidate as unknown as Candidate;
}

/**
 * Updates a candidate's data.
 */
export async function updateCandidate(
  orgId: string,
  candidateId: string,
  input: UpdateCandidateInput,
): Promise<Candidate> {
  const prisma = getPrismaClient();

  // Ensure it exists and belongs to org
  await getCandidate(orgId, candidateId);

  // If email is being changed, check for conflict
  if (input.email) {
    const conflict = await prisma.candidate.findFirst({
      where: {
        organizationId: orgId,
        email: input.email,
        NOT: { id: candidateId },
      },
    });
    if (conflict) {
      throw AppError.conflict(`A candidate with email "${input.email}" already exists in this organization`);
    }
  }

  return prisma.candidate.update({
    where: { id: candidateId },
    data: input,
  });
}

/**
 * Archives a candidate (sets status = ARCHIVED).
 */
export async function archiveCandidate(
  orgId: string,
  candidateId: string,
): Promise<Candidate> {
  const prisma = getPrismaClient();

  // Verify ownership
  await getCandidate(orgId, candidateId);

  return prisma.candidate.update({
    where: { id: candidateId },
    data: { status: 'ARCHIVED' },
  });
}
