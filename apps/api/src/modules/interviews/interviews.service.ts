import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { AccessToken } from 'livekit-server-sdk';
import { getPrismaClient } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { logger } from '../../config/logger.js';
import { createAiServiceToken } from '../../integrations/ai-service-token.js';
import { sendInterviewInvitationEmail } from '../../integrations/email.service.js';
import type {
  CreateInterviewInput,
  UpdateInterviewInput,
  RecruiterDecisionInput,
  ListInterviewsQuery,
  ConsentInput,
  RecordEventInput,
  RecordAnswerInput,
  CandidateStartResponse,
  CandidateAnswerResponse,
} from './interviews.schemas.js';
import {
  CandidateAnswerResponseSchema,
  CandidateStartResponseSchema,
} from './interviews.schemas.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateAccessToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex'); // 256-bit secure token
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

function tokenExpiryDate(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}

function generateLivekitRoomName(): string {
  return `interview-${crypto.randomBytes(12).toString('hex')}`;
}

async function requestInterviewAI(
  orgId: string,
  interviewId: string,
  endpoint: 'start' | 'answer',
  body: Record<string, unknown>,
): Promise<unknown> {
  const serviceToken = await createAiServiceToken({
    organizationId: orgId,
    interviewId,
    scopes: ['interview:conduct'],
  });

  let response: Response;
  try {
    response = await fetch(
      `${env.AI_SERVICE_URL.replace(/\/+$/, '')}/api/v1/interview/${endpoint}`,
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
    logger.error({ interviewId, endpoint }, 'Interview AI service request failed');
    throw AppError.serviceUnavailable('Interview AI service is unavailable');
  }

  if (!response.ok) {
    if (response.status === 401) {
      logger.error(
        { interviewId, endpoint, status: response.status },
        'AI service rejected the internal token; verify AI_SERVICE_SECRET matches SECRET_KEY, both use HS256 with the configured issuer/audience, and restart both services after configuration changes',
      );
      throw AppError.serviceUnavailable('Interview AI service authentication failed');
    }
    logger.error({ interviewId, endpoint, status: response.status }, 'Interview AI service returned an error');
    throw AppError.serviceUnavailable('Interview AI service could not process this request');
  }

  try {
    return await response.json() as unknown;
  } catch {
    logger.error({ interviewId, endpoint }, 'Interview AI service returned invalid JSON');
    throw AppError.serviceUnavailable('Interview AI service returned an invalid response');
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function createInterview(
  orgId: string,
  userId: string,
  input: CreateInterviewInput,
): Promise<{ interview: Record<string, unknown>; rawToken: string; inviteUrl: string }> {
  const prisma = getPrismaClient();
  const expiryHours = input.tokenExpiryHours ?? env.INTERVIEW_TOKEN_EXPIRY_HOURS;
  const { rawToken, tokenHash } = generateAccessToken();
  const tokenExpiresAt = tokenExpiryDate(expiryHours);
  const livekitRoomName = generateLivekitRoomName();

  // Verify candidate and job belong to org
  const [candidate, job] = await Promise.all([
    prisma.candidate.findFirst({ where: { id: input.candidateId, organizationId: orgId } }),
    prisma.job.findFirst({ where: { id: input.jobId, organizationId: orgId } }),
  ]);
  if (!candidate) throw AppError.notFound('Candidate not found in this organization');
  if (!job) throw AppError.notFound('Job not found in this organization');

  const title =
    input.title ?? `${job.title} — ${candidate.firstName} ${candidate.lastName}`;

  const interview = await prisma.interview.create({
    data: {
      organizationId: orgId,
      jobId: input.jobId,
      candidateId: input.candidateId,
      applicationId: input.applicationId ?? null,
      createdById: userId,
      title,
      type: input.type as 'TECHNICAL' | 'BEHAVIORAL' | 'SCREENING' | 'COMPREHENSIVE',
      status: 'SCHEDULED',
      language: input.language,
      durationMinutes: input.durationMinutes,
      instructions: input.instructions ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      accessTokenHash: tokenHash,
      tokenExpiresAt,
      livekitRoomName,
    },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
      job: { select: { id: true, title: true, department: true } },
    },
  });

  const inviteUrl = `${env.APP_URL}/interview/${rawToken}`;
  return { interview: interview as unknown as Record<string, unknown>, rawToken, inviteUrl };
}

export async function createInterviewAttempt(
  orgId: string,
  userId: string,
  interviewId: string,
): Promise<{ interview: Record<string, unknown>; rawToken: string; inviteUrl: string }> {
  const prisma = getPrismaClient();
  const previousAttempt = await prisma.interview.findFirst({
    where: { id: interviewId, organizationId: orgId },
  });
  if (!previousAttempt) throw AppError.notFound('Interview not found');

  const isExpired = previousAttempt.tokenExpiresAt <= new Date();
  const isClosed = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(previousAttempt.status);
  if (!isClosed && !isExpired) {
    throw AppError.conflict('A new attempt can only be created after the current interview is closed or its link expires');
  }

  const attemptCount = await prisma.interview.count({
    where: {
      organizationId: orgId,
      candidateId: previousAttempt.candidateId,
      jobId: previousAttempt.jobId,
      ...(previousAttempt.applicationId ? { applicationId: previousAttempt.applicationId } : {}),
    },
  });

  return createInterview(orgId, userId, {
    candidateId: previousAttempt.candidateId,
    jobId: previousAttempt.jobId,
    applicationId: previousAttempt.applicationId ?? undefined,
    type: previousAttempt.type,
    durationMinutes: previousAttempt.durationMinutes,
    language: previousAttempt.language,
    instructions: previousAttempt.instructions ?? undefined,
    title: `${previousAttempt.title} — Attempt ${attemptCount + 1}`,
  });
}

export async function listInterviews(
  orgId: string,
  query: ListInterviewsQuery,
): Promise<{ data: unknown[]; total: number; page: number; limit: number; pages: number }> {
  const prisma = getPrismaClient();
  const { status, jobId, candidateId, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    organizationId: orgId,
    ...(status ? { status: status as 'SCHEDULED' } : {}),
    ...(jobId ? { jobId } : {}),
    ...(candidateId ? { candidateId } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.interview.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
        job: { select: { id: true, title: true, department: true } },
        evaluation: { select: { overallScore: true, recommendation: true } },
      },
    }),
    prisma.interview.count({ where }),
  ]);

  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getInterview(orgId: string, interviewId: string): Promise<unknown> {
  const prisma = getPrismaClient();
  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, organizationId: orgId },
    include: {
      candidate: true,
      job: { select: { id: true, title: true, department: true, description: true } },
      application: true,
      questions: { orderBy: { order: 'asc' }, include: { answer: true } },
      events: { orderBy: { createdAt: 'asc' } },
      consent: true,
      evaluation: true,
    },
  });
  if (!interview) throw AppError.notFound('Interview not found');
  return interview;
}

export async function updateInterview(
  orgId: string,
  interviewId: string,
  input: UpdateInterviewInput,
): Promise<unknown> {
  const prisma = getPrismaClient();
  const existing = await prisma.interview.findFirst({
    where: { id: interviewId, organizationId: orgId },
  });
  if (!existing) throw AppError.notFound('Interview not found');
  if (existing.status === 'COMPLETED' && input.status && input.status !== 'COMPLETED') {
    throw AppError.conflict('A completed interview cannot be reopened; create a new interview attempt');
  }

  const isClosingStatus =
    input.status !== undefined &&
    ['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(input.status);

  return prisma.interview.update({
    where: { id: interviewId },
    data: {
      ...(input.status !== undefined ? { status: input.status as 'SCHEDULED' } : {}),
      ...(isClosingStatus ? { tokenRevokedAt: existing.tokenRevokedAt ?? new Date() } : {}),
      ...(input.status === 'COMPLETED'
        ? { completedAt: existing.completedAt ?? new Date() }
        : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: new Date(input.scheduledAt) } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
    },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
      job: { select: { id: true, title: true, department: true } },
    },
  });
}

export async function validateAccessToken(
  rawToken: string,
): Promise<{ interview: unknown; candidate: unknown; job: unknown; alreadyCompleted?: boolean } | null> {
  const prisma = getPrismaClient();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const interview = await prisma.interview.findFirst({
    where: { accessTokenHash: tokenHash },
    include: {
      candidate: { select: { id: true, firstName: true } },
      job: { select: { id: true, title: true, department: true } },
      consent: true,
      questions: { orderBy: { order: 'asc' }, include: { answer: true } },
    },
  });

  if (!interview) return null;
  const alreadyCompleted = interview.status === 'COMPLETED';
  if (
    !alreadyCompleted &&
    (interview.tokenRevokedAt !== null ||
      interview.tokenExpiresAt <= new Date() ||
      ['CANCELLED', 'EXPIRED', 'FAILED'].includes(interview.status))
  ) {
    return null;
  }

  return {
    interview: {
      id: interview.id,
      title: interview.title,
      type: interview.type,
      status: interview.status,
      language: interview.language,
      durationMinutes: interview.durationMinutes,
      instructions: interview.instructions,
      tokenExpiresAt: interview.tokenExpiresAt,
      hasConsented: !!interview.consent?.audioRecordingConsent,
      consent: {
        aiDisclosureAccepted: interview.consent?.aiDisclosureAccepted === true,
        audioRecordingConsent: interview.consent?.audioRecordingConsent === true,
        videoRecordingConsent: interview.consent?.videoRecordingConsent === true,
      },
      currentQuestionIndex: interview.currentQuestionIndex,
      startedAt: interview.startedAt,
      sessionHistory: interview.questions.map((question) => ({
        questionNumber: question.order,
        questionText: question.text,
        transcript: question.answer?.transcript ?? null,
      })),
    },
    candidate: interview.candidate,
    job: interview.job,
    ...(alreadyCompleted ? { alreadyCompleted: true } : {}),
  };
}

export async function recordConsent(
  rawToken: string,
  consentData: ConsentInput & { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const prisma = getPrismaClient();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const interview = await prisma.interview.findFirst({
    where: {
      accessTokenHash: tokenHash,
      tokenRevokedAt: null,
      tokenExpiresAt: { gt: new Date() },
      status: { notIn: ['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'] },
    },
  });
  if (!interview) throw AppError.unauthorized('Invalid or expired interview token');

  await prisma.interviewConsent.upsert({
    where: { interviewId: interview.id },
    update: {
      aiDisclosureAccepted: consentData.aiDisclosureAccepted,
      audioRecordingConsent: consentData.audioRecordingConsent,
      videoRecordingConsent: consentData.videoRecordingConsent,
      ipAddress: consentData.ipAddress ?? null,
      userAgent: consentData.userAgent ?? null,
      consentedAt: new Date(),
    },
    create: {
      interviewId: interview.id,
      aiDisclosureAccepted: consentData.aiDisclosureAccepted,
      audioRecordingConsent: consentData.audioRecordingConsent,
      videoRecordingConsent: consentData.videoRecordingConsent,
      privacyPolicyVersion: consentData.privacyPolicyVersion,
      ipAddress: consentData.ipAddress ?? null,
      userAgent: consentData.userAgent ?? null,
    },
  });

  // Transition to READY state if still SCHEDULED/INVITED
  if (interview.status === 'SCHEDULED' || interview.status === 'INVITED') {
    await prisma.interview.update({
      where: { id: interview.id },
      data: { status: 'READY' },
    });
  }
}

export async function recordEvent(
  rawToken: string,
  eventData: RecordEventInput,
): Promise<void> {
  const prisma = getPrismaClient();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const interview = await prisma.interview.findFirst({
    where: {
      accessTokenHash: tokenHash,
      tokenRevokedAt: null,
      tokenExpiresAt: { gt: new Date() },
      status: { notIn: ['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'] },
    },
    select: { id: true },
  });
  if (!interview) throw AppError.unauthorized('Invalid interview token');

  await prisma.interviewEvent.create({
    data: {
      interviewId: interview.id,
      eventType: eventData.eventType,
      durationMs: eventData.durationMs ?? null,
      metadata: (eventData.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function startCandidateInterview(rawToken: string): Promise<CandidateStartResponse> {
  const prisma = getPrismaClient();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const interview = await prisma.interview.findFirst({
    where: {
      accessTokenHash: tokenHash,
      tokenRevokedAt: null,
      tokenExpiresAt: { gt: new Date() },
      status: { notIn: ['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'] },
    },
    include: {
      consent: true,
      candidate: true,
      job: true,
    },
  });

  if (!interview) throw AppError.unauthorized('Invalid, expired, or completed interview link');
  if (!interview.consent?.audioRecordingConsent) {
    throw AppError.forbidden('Audio recording consent is required before starting the interview');
  }
  if (interview.status === 'IN_PROGRESS' || interview.currentQuestionIndex > 0) {
    throw AppError.conflict('This interview attempt is already active; reconnect to its current session');
  }

  const rawResponse = await requestInterviewAI(interview.organizationId, interview.id, 'start', {
    interviewId: interview.id,
    candidateName: interview.candidate.firstName,
    jobTitle: interview.job.title,
    language: interview.language,
    instructions: interview.instructions,
  });
  const parsedResponse = CandidateStartResponseSchema.safeParse(rawResponse);
  if (!parsedResponse.success) {
    logger.error({ interviewId: interview.id }, 'Interview AI start response failed validation');
    throw AppError.serviceUnavailable('Interview AI service returned an invalid start response');
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.interview.updateMany({
      where: {
        id: interview.id,
        accessTokenHash: tokenHash,
        tokenRevokedAt: null,
        tokenExpiresAt: { gt: now },
        status: interview.status,
        currentQuestionIndex: 0,
      },
      data: {
        status: 'IN_PROGRESS',
        startedAt: interview.startedAt ?? now,
      },
    });
    if (claimed.count !== 1) {
      throw AppError.conflict('This interview session has already been started; reconnect to continue');
    }

    await tx.interviewQuestion.create({
      data: {
        interviewId: interview.id,
        order: 1,
        text: parsedResponse.data.firstQuestion,
        status: 'ASKED',
        askedAt: now,
      },
    });
  });

  return parsedResponse.data;
}

export async function submitCandidateAnswer(
  rawToken: string,
  input: RecordAnswerInput,
): Promise<CandidateAnswerResponse> {
  const prisma = getPrismaClient();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const interview = await prisma.interview.findFirst({
    where: {
      accessTokenHash: tokenHash,
      tokenRevokedAt: null,
      tokenExpiresAt: { gt: new Date() },
      status: { in: ['IN_PROGRESS', 'PAUSED'] },
    },
    include: {
      consent: true,
      candidate: true,
      job: true,
      questions: { orderBy: { order: 'asc' }, include: { answer: true } },
    },
  });

  if (!interview) throw AppError.unauthorized('Invalid, expired, or completed interview link');
  if (!interview.consent?.audioRecordingConsent) {
    throw AppError.forbidden('Audio recording consent is required before submitting answers');
  }
  if (input.questionNumber !== interview.currentQuestionIndex + 1) {
    throw AppError.conflict('The interview session has advanced; reconnect before submitting an answer');
  }

  const activeQuestion = interview.questions.find((question) => question.order === input.questionNumber);
  if (!activeQuestion || activeQuestion.answer || activeQuestion.text !== input.questionText) {
    throw AppError.conflict('This is not the active unanswered interview question');
  }

  const totalQuestions = Math.max(3, Math.ceil(interview.durationMinutes / 5));
  const history = interview.questions
    .filter((question) => question.answer)
    .map((question) => ({
      question: question.text,
      answer: question.answer!.transcript,
      questionNumber: question.order,
    }));
  const questionId =
    input.questionNumber === 1
      ? 'greeting'
      : input.questionNumber === 2
        ? 'q-about-yourself'
        : `q-${input.questionNumber}`;
  const rawResponse = await requestInterviewAI(interview.organizationId, interview.id, 'answer', {
    interviewId: interview.id,
    questionId,
    questionText: activeQuestion.text,
    questionNumber: input.questionNumber,
    totalQuestions,
    audioBase64: input.audioBase64,
    mimeType: input.mimeType ?? 'audio/webm',
    history,
    candidateName: interview.candidate.firstName,
    jobTitle: interview.job.title,
    jobDescription: interview.job.department,
    language: interview.language,
  });
  const parsedResponse = CandidateAnswerResponseSchema.safeParse(rawResponse);
  if (!parsedResponse.success) {
    logger.error({ interviewId: interview.id }, 'Interview AI answer response failed validation');
    throw AppError.serviceUnavailable('Interview AI service returned an invalid answer response');
  }

  const answer = parsedResponse.data;
  const isComplete = answer.interviewComplete || input.questionNumber >= totalQuestions;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.interview.updateMany({
      where: {
        id: interview.id,
        accessTokenHash: tokenHash,
        tokenRevokedAt: null,
        tokenExpiresAt: { gt: now },
        status: interview.status,
        currentQuestionIndex: input.questionNumber - 1,
      },
      data: {
        status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
        currentQuestionIndex: input.questionNumber,
        ...(isComplete ? { completedAt: now, tokenRevokedAt: now } : {}),
      },
    });
    if (claimed.count !== 1) {
      throw AppError.conflict('This interview session changed; reload before submitting another answer');
    }

    await tx.interviewQuestion.update({
      where: { id: activeQuestion.id },
      data: { status: 'ANSWERED' },
    });
    await tx.interviewAnswer.create({
      data: {
        questionId: activeQuestion.id,
        transcript: answer.transcript || '[Silence / Unintelligible]',
      },
    });

    if (!isComplete && answer.nextQuestion) {
      await tx.interviewQuestion.create({
        data: {
          interviewId: interview.id,
          order: input.questionNumber + 1,
          text: answer.nextQuestion,
          status: 'PENDING',
        },
      });
    }

    if (isComplete) {
      await tx.interviewEvent.create({
        data: {
          interviewId: interview.id,
          eventType: 'INTERVIEW_COMPLETED',
          metadata: { questionNumber: input.questionNumber },
        },
      });
    }
  });

  return answer;
}

export async function recordDecision(
  orgId: string,
  interviewId: string,
  userId: string,
  input: RecruiterDecisionInput,
): Promise<unknown> {
  const prisma = getPrismaClient();
  const existing = await prisma.interview.findFirst({
    where: { id: interviewId, organizationId: orgId },
  });
  if (!existing) throw AppError.notFound('Interview not found');

  // Update the interview decision fields
  const updated = await prisma.interview.update({
    where: { id: interviewId },
    data: {
      recruiterDecision: input.decision as 'ADVANCE' | 'HOLD' | 'REJECT' | 'REQUEST_INTERVIEW',
      decisionNotes: input.notes ?? null,
      decidedAt: new Date(),
      decidedById: userId,
    },
    include: {
      evaluation: true,
      candidate: { select: { id: true, firstName: true, lastName: true } },
      job: { select: { id: true, title: true } },
    },
  });

  return updated;
}

export async function regenerateToken(
  orgId: string,
  interviewId: string,
  expiryHours?: number,
): Promise<{ rawToken: string; inviteUrl: string; expiresAt: Date }> {
  const prisma = getPrismaClient();
  const existing = await prisma.interview.findFirst({
    where: { id: interviewId, organizationId: orgId },
  });
  if (!existing) throw AppError.notFound('Interview not found');
  if (['COMPLETED', 'IN_PROGRESS', 'PAUSED'].includes(existing.status)) {
    throw AppError.conflict('This interview URL cannot be rotated after the interview has started or completed');
  }

  const hours = expiryHours ?? env.INTERVIEW_TOKEN_EXPIRY_HOURS;
  const { rawToken, tokenHash } = generateAccessToken();
  const expiresAt = tokenExpiryDate(hours);

  await prisma.interview.update({
    where: { id: interviewId },
    data: {
      accessTokenHash: tokenHash,
      tokenExpiresAt: expiresAt,
      tokenRevokedAt: null,
      status: 'INVITED',
    },
  });

  const inviteUrl = `${env.APP_URL}/interview/${rawToken}`;
  return { rawToken, inviteUrl, expiresAt };
}

export async function sendInterviewInvite(
  orgId: string,
  interviewId: string,
  recipientEmail?: string,
): Promise<{ messageId: string; to: string; inviteUrl: string }> {
  const prisma = getPrismaClient();
  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, organizationId: orgId },
    include: {
      candidate: true,
      job: true,
    },
  });
  if (!interview) throw AppError.notFound('Interview not found');

  const to = (recipientEmail || interview.candidate.email).trim().toLowerCase();
  if (!to || !to.includes('@')) {
    throw AppError.badRequest('A valid recipient email address is required');
  }

  // Update candidate email if manually corrected
  if (recipientEmail && recipientEmail.toLowerCase() !== interview.candidate.email.toLowerCase()) {
    await prisma.candidate.update({
      where: { id: interview.candidate.id },
      data: { email: to },
    });
  }

  // Generate fresh secure access token for email URL
  const { rawToken, inviteUrl, expiresAt } = await regenerateToken(orgId, interviewId);

  const candidateName = `${interview.candidate.firstName} ${interview.candidate.lastName}`.trim();
  const emailResult = await sendInterviewInvitationEmail({
    to,
    candidateName,
    jobTitle: interview.job.title,
    durationMinutes: interview.durationMinutes,
    inviteUrl,
    instructions: interview.instructions || undefined,
    expiresAt,
  });

  // Record submission status event
  await prisma.interviewEvent.create({
    data: {
      interviewId: interview.id,
      eventType: 'INVITATION_EMAIL_SUBMITTED',
      metadata: {
        messageId: emailResult.messageId,
        recipient: to,
        provider: env.EMAIL_PROVIDER || 'brevo',
        submittedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  return {
    messageId: emailResult.messageId,
    to,
    inviteUrl,
  };
}

export async function getLiveKitToken(
  rawToken: string,
): Promise<{ livekitUrl: string | null; roomName: string; participantToken: string | null; isConfigured: boolean }> {
  const prisma = getPrismaClient();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const interview = await prisma.interview.findFirst({
    where: {
      accessTokenHash: tokenHash,
      tokenRevokedAt: null,
      tokenExpiresAt: { gt: new Date() },
      status: { notIn: ['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'] },
    },
    include: {
      candidate: true,
      consent: true,
    },
  });

  if (!interview) throw AppError.unauthorized('Invalid or expired interview session');
  if (
    interview.consent?.aiDisclosureAccepted !== true ||
    interview.consent.audioRecordingConsent !== true ||
    interview.consent.videoRecordingConsent !== true
  ) {
    throw AppError.forbidden('Explicit AI, audio, and video consent is required before connecting media');
  }

  const isConfigured = Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
  const roomName = interview.livekitRoomName;
  const participantIdentity = `cand-${interview.candidate.id}`;
  const participantName = `${interview.candidate.firstName} ${interview.candidate.lastName}`.trim();

  let participantToken: string | null = null;
  if (isConfigured) {
    const at = new AccessToken(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!, {
      identity: participantIdentity,
      name: participantName,
      ttl: '2h',
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    participantToken = await at.toJwt();
  }

  return {
    livekitUrl: env.LIVEKIT_URL || null,
    roomName,
    participantToken,
    isConfigured,
  };
}
