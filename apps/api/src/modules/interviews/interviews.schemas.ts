import { z } from 'zod';

// ---------------------------------------------------------------------------
// Interview CRUD schemas
// ---------------------------------------------------------------------------

export const CreateInterviewSchema = z.object({
  candidateId: z.string().uuid(),
  jobId: z.string().uuid(),
  applicationId: z.string().uuid().optional(),
  type: z.enum(['TECHNICAL', 'BEHAVIORAL', 'SCREENING', 'COMPREHENSIVE']).default('TECHNICAL'),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(10).max(120).default(30),
  language: z.string().default('en'),
  instructions: z.string().max(2000).optional(),
  tokenExpiryHours: z.number().int().min(1).max(168).optional(),
  title: z.string().max(255).optional(),
});

export const UpdateInterviewSchema = z.object({
  status: z
    .enum(['DRAFT', 'SCHEDULED', 'INVITED', 'READY', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'])
    .optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(10).max(120).optional(),
  instructions: z.string().max(2000).optional(),
  language: z.string().optional(),
});

export const RecruiterDecisionSchema = z.object({
  decision: z.enum(['ADVANCE', 'HOLD', 'REJECT', 'REQUEST_INTERVIEW']),
  notes: z.string().max(5000).optional(),
});

export const ListInterviewsQuerySchema = z.object({
  status: z.string().optional(),
  jobId: z.string().uuid().optional(),
  candidateId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Public access schemas
export const ConsentSchema = z.object({
  aiDisclosureAccepted: z.boolean(),
  audioRecordingConsent: z.boolean().default(false),
  videoRecordingConsent: z.boolean().default(false),
  privacyPolicyVersion: z.string().default('1.0'),
});

export const RecordEventSchema = z.object({
  eventType: z.string().min(1).max(100),
  durationMs: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const RecordAnswerSchema = z.object({
  questionNumber: z.number().int().min(1).max(100),
  questionText: z.string().trim().min(1).max(5000),
  audioBase64: z.string().min(1).max(7_000_000),
  mimeType: z.string().max(100).optional(),
});

export const CandidateStartResponseSchema = z.object({
  greeting: z.string(),
  firstQuestion: z.string().min(1),
  audioBase64: z.string(),
  questionId: z.string().optional(),
});

export const CandidateAnswerResponseSchema = z.object({
  transcript: z.string(),
  nextQuestion: z.string().nullable().optional(),
  audioBase64: z.string().nullable().optional(),
  interviewComplete: z.boolean(),
  followUp: z.string().nullable().optional(),
});

export const RegenerateTokenSchema = z.object({
  expiryHours: z.number().int().min(1).max(168).optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type CreateInterviewInput = z.infer<typeof CreateInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof UpdateInterviewSchema>;
export type RecruiterDecisionInput = z.infer<typeof RecruiterDecisionSchema>;
export type ListInterviewsQuery = z.infer<typeof ListInterviewsQuerySchema>;
export type ConsentInput = z.infer<typeof ConsentSchema>;
export type RecordEventInput = z.infer<typeof RecordEventSchema>;
export type RecordAnswerInput = z.infer<typeof RecordAnswerSchema>;
export type CandidateStartResponse = z.infer<typeof CandidateStartResponseSchema>;
export type CandidateAnswerResponse = z.infer<typeof CandidateAnswerResponseSchema>;
