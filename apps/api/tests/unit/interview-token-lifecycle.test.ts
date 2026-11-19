import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    interview: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    candidate: { findFirst: vi.fn() },
    job: { findFirst: vi.fn() },
    interviewQuestion: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    interviewAnswer: { create: vi.fn(), upsert: vi.fn() },
    interviewEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/config/database.js', () => ({
  getPrismaClient: () => mocks.prisma,
}));

import {
  createInterviewAttempt,
  getLiveKitToken,
  startCandidateInterview,
  submitCandidateAnswer,
  validateAccessToken,
} from '../../src/modules/interviews/interviews.service.js';

const rawToken = 'a'.repeat(64);
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
const organizationId = 'org-lifecycle';
const interviewId = 'interview-lifecycle';

function makeInterview(overrides: Record<string, unknown> = {}) {
  return {
    id: interviewId,
    organizationId,
    jobId: 'job-lifecycle',
    candidateId: 'candidate-lifecycle',
    applicationId: 'application-lifecycle',
    createdById: 'recruiter-lifecycle',
    title: 'Engineer interview',
    type: 'TECHNICAL',
    status: 'READY',
    language: 'en',
    durationMinutes: 30,
    instructions: null,
    accessTokenHash: tokenHash,
    tokenExpiresAt: new Date(Date.now() + 60_000),
    tokenRevokedAt: null,
    livekitRoomName: 'interview-room-old',
    currentQuestionIndex: 0,
    startedAt: null,
    completedAt: null,
    consent: {
      aiDisclosureAccepted: true,
      audioRecordingConsent: true,
      videoRecordingConsent: true,
    },
    questions: [],
    candidate: { id: 'candidate-lifecycle', firstName: 'Ada', lastName: 'Lovelace' },
    job: { id: 'job-lifecycle', title: 'Engineer', department: 'Engineering' },
    ...overrides,
  };
}

describe('Interview invitation URL lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof mocks.prisma) => unknown) =>
        callback(mocks.prisma),
    );
    mocks.prisma.interview.count.mockResolvedValue(1);
    mocks.prisma.candidate.findFirst.mockResolvedValue({
      id: 'candidate-lifecycle',
      organizationId,
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    mocks.prisma.job.findFirst.mockResolvedValue({
      id: 'job-lifecycle',
      organizationId,
      title: 'Engineer',
      department: 'Engineering',
    });
  });

  it('identifies a revoked completed URL so the client can show the completed page', async () => {
    mocks.prisma.interview.findFirst.mockResolvedValue(makeInterview({
      status: 'COMPLETED',
      tokenRevokedAt: new Date(),
      tokenExpiresAt: new Date(Date.now() - 60_000),
    }));

    const result = await validateAccessToken(rawToken);

    expect(result?.alreadyCompleted).toBe(true);
    expect((result?.interview as { status: string }).status).toBe('COMPLETED');
  });

  it('returns false for every consent flag when no consent record exists', async () => {
    mocks.prisma.interview.findFirst.mockResolvedValue(makeInterview({ consent: null }));

    const result = await validateAccessToken(rawToken);
    const interview = result?.interview as {
      hasConsented: boolean;
      consent: {
        aiDisclosureAccepted: boolean;
        audioRecordingConsent: boolean;
        videoRecordingConsent: boolean;
      };
    };

    expect(interview.hasConsented).toBe(false);
    expect(interview.consent).toEqual({
      aiDisclosureAccepted: false,
      audioRecordingConsent: false,
      videoRecordingConsent: false,
    });
  });

  it('rejects expired links instead of resuming the session', async () => {
    mocks.prisma.interview.findFirst.mockResolvedValue(makeInterview({
      status: 'IN_PROGRESS',
      tokenExpiresAt: new Date(Date.now() - 1_000),
    }));

    await expect(validateAccessToken(rawToken)).resolves.toBeNull();
  });

  it('returns the saved question and transcript for an active reconnect', async () => {
    mocks.prisma.interview.findFirst.mockResolvedValue(makeInterview({
      status: 'PAUSED',
      currentQuestionIndex: 1,
      startedAt: new Date(),
      questions: [
        {
          order: 1,
          text: 'Tell me about yourself',
          answer: { transcript: 'I am a software engineer.' },
        },
        {
          order: 2,
          text: 'Describe a recent project',
          answer: null,
        },
      ],
    }));

    const result = await validateAccessToken(rawToken);

    expect((result?.interview as { status: string }).status).toBe('PAUSED');
    expect((result?.interview as { currentQuestionIndex: number }).currentQuestionIndex).toBe(1);
    expect((result?.interview as { sessionHistory: unknown[] }).sessionHistory).toEqual([
      { questionNumber: 1, questionText: 'Tell me about yourself', transcript: 'I am a software engineer.' },
      { questionNumber: 2, questionText: 'Describe a recent project', transcript: null },
    ]);
  });

  it('blocks answer submission once the invitation has been completed or revoked', async () => {
    mocks.prisma.interview.findFirst.mockResolvedValue(null);

    await expect(submitCandidateAnswer(rawToken, {
      questionNumber: 1,
      questionText: 'Tell me about yourself',
      audioBase64: 'YXVkaW8=',
    })).rejects.toMatchObject({ statusCode: 401 });

    expect(mocks.prisma.interview.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accessTokenHash: tokenHash,
          tokenRevokedAt: null,
          status: { in: ['IN_PROGRESS', 'PAUSED'] },
        }),
      }),
    );
  });

  it('does not restart a completed or already active interview attempt', async () => {
    mocks.prisma.interview.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeInterview({
        status: 'IN_PROGRESS',
        currentQuestionIndex: 1,
      }));

    await expect(startCandidateInterview(rawToken)).rejects.toMatchObject({ statusCode: 401 });
    await expect(startCandidateInterview(rawToken)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('creates a new attempt with a distinct URL and room without changing the prior attempt', async () => {
    const priorAttempt = makeInterview({
      status: 'COMPLETED',
      tokenRevokedAt: new Date(),
    });
    mocks.prisma.interview.findFirst.mockResolvedValue(priorAttempt);
    mocks.prisma.interview.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      id: 'interview-attempt-2',
    }));

    const created = await createInterviewAttempt(organizationId, 'recruiter-lifecycle', interviewId);

    expect(created.interview.id).toBe('interview-attempt-2');
    expect(created.rawToken).not.toBe(rawToken);
    expect(created.inviteUrl).toContain(created.rawToken);
    expect(mocks.prisma.interview.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId,
        candidateId: priorAttempt.candidateId,
        jobId: priorAttempt.jobId,
        accessTokenHash: crypto.createHash('sha256').update(created.rawToken).digest('hex'),
        livekitRoomName: expect.not.stringMatching('interview-room-old'),
      }),
    }));
    expect(mocks.prisma.interview.update).not.toHaveBeenCalled();
  });

  it('rejects creating another attempt while the current token is still active', async () => {
    mocks.prisma.interview.findFirst.mockResolvedValue(makeInterview());

    await expect(
      createInterviewAttempt(organizationId, 'recruiter-lifecycle', interviewId),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.prisma.interview.create).not.toHaveBeenCalled();
  });

  it('does not create attempts for an interview outside the requested organization', async () => {
    mocks.prisma.interview.findFirst.mockResolvedValue(null);

    await expect(
      createInterviewAttempt('another-org', 'recruiter-lifecycle', interviewId),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(mocks.prisma.interview.findFirst).toHaveBeenCalledWith({
      where: { id: interviewId, organizationId: 'another-org' },
    });
    expect(mocks.prisma.interview.create).not.toHaveBeenCalled();
  });

  it('does not mint a LiveKit token for a completed invitation URL', async () => {
    mocks.prisma.interview.findFirst.mockResolvedValue(null);

    await expect(getLiveKitToken(rawToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it.each([
    ['AI disclosure', { aiDisclosureAccepted: false, audioRecordingConsent: true, videoRecordingConsent: true }],
    ['audio', { aiDisclosureAccepted: true, audioRecordingConsent: false, videoRecordingConsent: true }],
    ['video', { aiDisclosureAccepted: true, audioRecordingConsent: true, videoRecordingConsent: false }],
  ])('does not issue a LiveKit token without explicit %s consent', async (_label, consent) => {
    mocks.prisma.interview.findFirst.mockResolvedValue(makeInterview({ consent }));

    await expect(getLiveKitToken(rawToken)).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.prisma.interview.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ consent: true }) }),
    );
  });

  it('allows LiveKit token retrieval when all required consent is recorded', async () => {
    mocks.prisma.interview.findFirst.mockResolvedValue(makeInterview());

    await expect(getLiveKitToken(rawToken)).resolves.toMatchObject({
      roomName: 'interview-room-old',
    });
  });
});
