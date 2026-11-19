// ---------------------------------------------------------------------------
// Applications service — recruitment pipeline management
// ---------------------------------------------------------------------------
import type { Application, Prisma } from '@prisma/client';
import { getPrismaClient } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import type {
  CreateApplicationInput,
  UpdateApplicationStatusInput,
} from './applications.schemas.js';

export async function createApplication(
  orgId: string,
  input: CreateApplicationInput,
): Promise<Application> {
  const prisma = getPrismaClient();

  // 1. Verify Job belongs to org
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, organizationId: orgId },
  });
  if (!job) {
    throw AppError.notFound('Job not found in this organization');
  }

  // 2. Verify Candidate belongs to org
  const candidate = await prisma.candidate.findFirst({
    where: { id: input.candidateId, organizationId: orgId },
  });
  if (!candidate) {
    throw AppError.notFound('Candidate not found in this organization');
  }

  // 3. Verify Resume if supplied
  if (input.resumeId) {
    const resume = await prisma.resume.findFirst({
      where: {
        id: input.resumeId,
        organizationId: orgId,
        candidateId: input.candidateId,
      },
    });
    if (!resume) {
      throw AppError.badRequest('Resume not found or does not belong to candidate');
    }
  }

  // 4. Check for duplicate application
  const existing = await prisma.application.findUnique({
    where: {
      jobId_candidateId: {
        jobId: input.jobId,
        candidateId: input.candidateId,
      },
    },
  });
  if (existing) {
    throw AppError.conflict('Candidate has already applied for this job');
  }

  // 5. Create application
  return prisma.application.create({
    data: {
      organizationId: orgId,
      jobId: input.jobId,
      candidateId: input.candidateId,
      resumeId: input.resumeId ?? null,
      stage: input.stage ?? 'Resume Screening',
    },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          department: true,
          location: true,
          status: true,
        },
      },
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          headline: true,
        },
      },
      resume: {
        select: {
          id: true,
          fileName: true,
          parsingStatus: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function listApplications(
  orgId: string,
  filters?: { jobId?: string; candidateId?: string; status?: string },
): Promise<Application[]> {
  const prisma = getPrismaClient();

  const where: Prisma.ApplicationWhereInput = { organizationId: orgId };

  if (filters?.jobId) {
    where.jobId = filters.jobId;
  }
  if (filters?.candidateId) {
    where.candidateId = filters.candidateId;
  }
  if (filters?.status) {
    where.status = filters.status as Application['status'];
  }

  return prisma.application.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          department: true,
          location: true,
          status: true,
        },
      },
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          headline: true,
        },
      },
      resume: {
        select: {
          id: true,
          fileName: true,
          parsingStatus: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function getApplication(
  orgId: string,
  applicationId: string,
): Promise<Application> {
  const prisma = getPrismaClient();

  const app = await prisma.application.findFirst({
    where: { id: applicationId, organizationId: orgId },
    include: {
      job: true,
      candidate: true,
      resume: true,
    },
  });

  if (!app) {
    throw AppError.notFound('Application not found');
  }

  return app;
}

export async function updateApplicationStatus(
  orgId: string,
  applicationId: string,
  input: UpdateApplicationStatusInput,
): Promise<Application> {
  const prisma = getPrismaClient();

  const app = await prisma.application.findFirst({
    where: { id: applicationId, organizationId: orgId },
  });

  if (!app) {
    throw AppError.notFound('Application not found');
  }
  if (
    app.analysis &&
    typeof app.analysis === 'object' &&
    !Array.isArray(app.analysis) &&
    app.analysis.status === 'PROCESSING'
  ) {
    throw AppError.conflict('Application cannot be updated while resume screening is in progress');
  }

  return prisma.application.update({
    where: { id: applicationId },
    data: {
      status: input.status as Application['status'],
      stage: input.stage ?? app.stage,
    },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          department: true,
        },
      },
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      resume: {
        select: {
          id: true,
          fileName: true,
        },
      },
    },
  });
}
