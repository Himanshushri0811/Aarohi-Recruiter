import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { getPrismaClient } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { logger } from '../../config/logger.js';
import { createAiServiceToken } from '../../integrations/ai-service-token.js';
import {
  ResumeMatchReportSchema,
  type ResumeMatchReport,
  type ResumeScreeningResult,
} from './applications.schemas.js';

type ScreeningState = {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  requestId?: string;
  analysisId?: string;
  analyzedAt?: string;
  report?: ResumeMatchReport;
  message?: string;
};

function getScreeningState(value: Prisma.JsonValue | null): ScreeningState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const state = value as Prisma.JsonObject;
  if (state.status !== 'PROCESSING' && state.status !== 'COMPLETED' && state.status !== 'FAILED') {
    return null;
  }
  return state as ScreeningState;
}

function getParsedResumeData(value: Prisma.JsonValue | null): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'rawText'),
  );
}

function buildJobDescription(job: {
  title: string;
  department: string;
  location: string | null;
  employmentType: string | null;
  experienceLevel: string | null;
  description: string;
  requirements: string | null;
  responsibilities: string | null;
}): string {
  return [
    `Title: ${job.title}`,
    `Department: ${job.department}`,
    job.location ? `Location: ${job.location}` : '',
    job.employmentType ? `Employment type: ${job.employmentType}` : '',
    job.experienceLevel ? `Experience level: ${job.experienceLevel}` : '',
    `Description:\n${job.description}`,
    job.requirements ? `Requirements:\n${job.requirements}` : '',
    job.responsibilities ? `Responsibilities:\n${job.responsibilities}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function requestResumeAnalysis(
  orgId: string,
  applicationId: string,
  body: Record<string, unknown>,
): Promise<ResumeMatchReport> {
  const serviceToken = await createAiServiceToken({
    organizationId: orgId,
    applicationId,
    scopes: ['resume:screen'],
  });

  let response: Response;
  try {
    response = await fetch(
      `${env.AI_SERVICE_URL.replace(/\/+$/, '')}/api/v1/resume/analyze`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      },
    );
  } catch {
    logger.error({ applicationId }, 'Resume analysis service request failed');
    throw AppError.serviceUnavailable('Resume analysis service is unavailable');
  }

  if (!response.ok) {
    if (response.status === 401) {
      logger.error(
        { applicationId, status: response.status },
        'AI service rejected the internal token; verify AI_SERVICE_SECRET matches SECRET_KEY, both use HS256 with the configured issuer/audience, and restart both services after configuration changes',
      );
      throw AppError.serviceUnavailable('Resume analysis service authentication failed');
    }
    if (response.status === 422) {
      throw AppError.unprocessable('Resume analysis could not be completed. Verify the resume and job data.');
    }
    logger.error({ applicationId, status: response.status }, 'Resume analysis service returned an error');
    throw AppError.serviceUnavailable('Resume analysis service is unavailable');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    logger.error({ applicationId }, 'Resume analysis service returned invalid JSON');
    throw AppError.serviceUnavailable('Resume analysis service returned an invalid response');
  }

  const parsed = ResumeMatchReportSchema.safeParse(payload);
  if (!parsed.success) {
    logger.error(
      { applicationId, issues: parsed.error.issues.map((issue) => issue.path.join('.')) },
      'Resume analysis service returned an invalid report',
    );
    throw AppError.serviceUnavailable('Resume analysis service returned an invalid report');
  }

  return parsed.data;
}

export async function screenApplication(
  orgId: string,
  applicationId: string,
): Promise<ResumeScreeningResult> {
  const prisma = getPrismaClient();
  const application = await prisma.application.findFirst({
    where: { id: applicationId, organizationId: orgId },
    include: {
      job: true,
      candidate: { select: { id: true, organizationId: true } },
      resume: true,
    },
  });

  if (!application) throw AppError.notFound('Application not found');
  if (
    application.job.organizationId !== orgId ||
    application.candidate.organizationId !== orgId
  ) {
    throw AppError.notFound('Application not found');
  }

  const savedState = getScreeningState(application.analysis);
  if (savedState?.status === 'COMPLETED' && savedState.analysisId) {
    if (!application.resumeId) {
      throw AppError.conflict('The saved resume screening report is missing its resume');
    }
    const storedAnalysis = await prisma.resumeAnalysis.findFirst({
      where: {
        id: savedState.analysisId,
        organizationId: orgId,
        resumeId: application.resumeId,
        jobId: application.jobId,
      },
    });
    const storedReport = storedAnalysis
      ? ResumeMatchReportSchema.safeParse(storedAnalysis.structuredData)
      : null;
    if (!storedAnalysis || !storedReport?.success) {
      throw AppError.conflict('The saved resume screening report is unavailable or invalid');
    }
    return {
      applicationId,
      analysisId: storedAnalysis.id,
      analyzedAt: storedAnalysis.createdAt.toISOString(),
      report: storedReport.data,
    };
  }
  if (savedState?.status === 'PROCESSING') {
    throw AppError.conflict('Resume screening is already in progress');
  }

  let resume = application.resume;
  if (!resume && !application.resumeId) {
    resume = await prisma.resume.findFirst({
      where: {
        organizationId: orgId,
        candidateId: application.candidateId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  if (!resume) throw AppError.unprocessable('Upload a resume before running AI screening');
  if (resume.organizationId !== orgId || resume.candidateId !== application.candidateId) {
    throw AppError.notFound('Application not found');
  }
  if (resume.parsingStatus !== 'PARSED' || !resume.extractedText?.trim()) {
    throw AppError.unprocessable('The selected resume is not successfully parsed');
  }
  if (resume.extractedText.trim().length < 50) {
    throw AppError.unprocessable('The selected resume does not contain enough text for analysis');
  }

  const requestId = crypto.randomUUID();
  const processingState = {
    status: 'PROCESSING',
    requestId,
    startedAt: new Date().toISOString(),
  };
  let claim = await prisma.application.updateMany({
    where: {
      id: applicationId,
      organizationId: orgId,
      status: 'APPLIED',
    },
    data: {
      status: 'SCREENING',
      stage: 'AI Resume Screening',
      resumeId: resume.id,
      analysis: processingState,
    },
  });

  if (claim.count === 0 && application.status === 'SCREENING' && application.analysis === null) {
    claim = await prisma.application.updateMany({
      where: {
        id: applicationId,
        organizationId: orgId,
        status: 'SCREENING',
        analysis: { equals: Prisma.DbNull },
      },
      data: {
        stage: 'AI Resume Screening',
        resumeId: resume.id,
        analysis: processingState,
      },
    });
  }

  if (claim.count === 0) {
    const latest = await prisma.application.findFirst({
      where: { id: applicationId, organizationId: orgId },
      select: { analysis: true },
    });
    const latestState = latest ? getScreeningState(latest.analysis) : null;
    if (latestState?.status === 'PROCESSING') {
      throw AppError.conflict('Resume screening is already in progress');
    }
    throw AppError.conflict('Application is not available for resume screening');
  }

  try {
    const body = {
      organizationId: orgId,
      applicationId,
      jobId: application.jobId,
      resumeText: resume.extractedText,
      parsedResume: getParsedResumeData(resume.parsedData),
      jobTitle: application.job.title,
      jobDescription: buildJobDescription(application.job),
      jobSkills: application.job.skills,
    };
    const report = await requestResumeAnalysis(orgId, applicationId, body);
    const savedResult = await prisma.$transaction(async (tx) => {
      const analysis = await tx.resumeAnalysis.create({
        data: {
          organizationId: orgId,
          resumeId: resume.id,
          jobId: application.jobId,
          matchScore: report.matchScore,
          structuredData: report as Prisma.InputJsonValue,
          strengths: report.strengths.map((finding) => `${finding.title}: ${finding.summary}`),
          gaps: report.gaps.map((finding) => `${finding.title}: ${finding.summary}`),
          suggestedTopics: report.suggestedInterviewTopics,
          technicalAlignment: {
            requiredSkills: report.requiredSkills,
            preferredSkills: report.preferredSkills,
            experienceAssessment: report.experienceAssessment,
            projectAssessments: report.projectAssessments,
            educationAssessment: report.educationAssessment,
          } as Prisma.InputJsonValue,
          evidence: {
            missingQualifications: report.missingQualifications,
            strengths: report.strengths,
            gaps: report.gaps,
          } as Prisma.InputJsonValue,
          rubricDetails: {
            analysisConfidence: report.analysisConfidence,
            insufficientInformation: report.insufficientInformation,
            fitSummary: report.fitSummary,
          } as Prisma.InputJsonValue,
        },
      });
      const analyzedAt = analysis.createdAt.toISOString();

      const completedState: ScreeningState = {
        status: 'COMPLETED',
        analysisId: analysis.id,
        analyzedAt,
        report,
      };
      const update = await tx.application.updateMany({
        where: {
          id: applicationId,
          organizationId: orgId,
          status: 'SCREENING',
          analysis: { equals: processingState as Prisma.InputJsonValue },
        },
        data: {
          matchScore: report.matchScore,
          analysis: completedState as Prisma.InputJsonValue,
        },
      });
      if (update.count !== 1) {
        throw AppError.conflict('Application screening state changed before the report could be saved');
      }
      return { analysisId: analysis.id, analyzedAt };
    });

    return {
      applicationId,
      analysisId: savedResult.analysisId,
      analyzedAt: savedResult.analyzedAt,
      report,
    };
  } catch (error) {
    try {
      await prisma.application.updateMany({
        where: {
          id: applicationId,
          organizationId: orgId,
          status: 'SCREENING',
          analysis: { equals: processingState as Prisma.InputJsonValue },
        },
        data: {
          status: 'APPLIED',
          stage: 'Resume Screening',
          analysis: {
            status: 'FAILED',
            requestId,
            failedAt: new Date().toISOString(),
            message: 'Resume screening failed. Retry the analysis.',
          },
        },
      });
    } catch (cleanupError) {
      logger.error(
        { applicationId, cleanupError },
        'Could not release application after failed resume screening',
      );
    }
    throw error;
  }
}
