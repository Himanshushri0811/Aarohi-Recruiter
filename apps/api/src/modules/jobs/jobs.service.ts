import { getPrismaClient } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import type { CreateJobInput, UpdateJobInput } from './jobs.schemas.js';
import type { Job } from '@prisma/client';

const TERMINAL_STATUSES = ['ARCHIVED', 'CLOSED'];

export async function createJob(
  orgId: string,
  userId: string,
  input: CreateJobInput,
): Promise<Job> {
  const prisma = getPrismaClient();
  return prisma.job.create({
    data: {
      organizationId: orgId,
      createdById: userId,
      title: input.title,
      department: input.department,
      description: input.description,
      location: input.location,
      employmentType: input.employmentType,
      experienceLevel: input.experienceLevel,
      status: input.status as any,
      requirements: input.requirements,
      responsibilities: input.responsibilities,
      skills: input.skills ?? [],
    },
  });
}

export async function listJobs(
  orgId: string,
  filters?: { status?: string; search?: string },
): Promise<(Job & { _count: { applications: number } })[]> {
  const prisma = getPrismaClient();

  const where: any = { organizationId: orgId };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { department: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return prisma.job.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { applications: true } },
    },
  }) as any;
}

export async function getJob(
  orgId: string,
  jobId: string,
): Promise<Job & { _count: { applications: number } }> {
  const prisma = getPrismaClient();

  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: orgId },
    include: {
      _count: { select: { applications: true } },
    },
  });

  if (!job) {
    throw AppError.notFound('Job not found');
  }

  return job as any;
}

export async function updateJob(
  orgId: string,
  jobId: string,
  input: UpdateJobInput,
): Promise<Job> {
  const prisma = getPrismaClient();

  // Ensure job belongs to this org
  const existing = await prisma.job.findFirst({
    where: { id: jobId, organizationId: orgId },
  });

  if (!existing) {
    throw AppError.notFound('Job not found');
  }

  // Build update data with only provided fields
  const data: any = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.department !== undefined) data.department = input.department;
  if (input.description !== undefined) data.description = input.description;
  if (input.location !== undefined) data.location = input.location;
  if (input.employmentType !== undefined) data.employmentType = input.employmentType;
  if (input.experienceLevel !== undefined) data.experienceLevel = input.experienceLevel;
  if (input.status !== undefined) data.status = input.status;
  if (input.requirements !== undefined) data.requirements = input.requirements;
  if (input.responsibilities !== undefined) data.responsibilities = input.responsibilities;
  if (input.skills !== undefined) data.skills = input.skills;

  return prisma.job.update({
    where: { id: jobId },
    data,
  });
}

export async function updateJobStatus(
  orgId: string,
  jobId: string,
  status: string,
): Promise<Job> {
  const prisma = getPrismaClient();

  const existing = await prisma.job.findFirst({
    where: { id: jobId, organizationId: orgId },
  });

  if (!existing) {
    throw AppError.notFound('Job not found');
  }

  // ARCHIVED/CLOSED jobs cannot be published/drafted again
  if (TERMINAL_STATUSES.includes(existing.status) && !TERMINAL_STATUSES.includes(status)) {
    throw AppError.badRequest(
      `Cannot change status of a ${existing.status.toLowerCase()} job back to ${status}`,
    );
  }

  return prisma.job.update({
    where: { id: jobId },
    data: { status: status as any },
  });
}

export async function deleteJob(orgId: string, jobId: string): Promise<void> {
  const prisma = getPrismaClient();

  const existing = await prisma.job.findFirst({
    where: { id: jobId, organizationId: orgId },
  });

  if (!existing) {
    throw AppError.notFound('Job not found');
  }

  await prisma.job.delete({ where: { id: jobId } });
}
