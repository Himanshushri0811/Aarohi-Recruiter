import { z } from 'zod';

export const APPLICATION_STATUSES = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
  'OFFERED',
  'REJECTED',
  'WITHDRAWN',
] as const;

export const CreateApplicationSchema = z.object({
  jobId: z.string().uuid('Invalid jobId format'),
  candidateId: z.string().uuid('Invalid candidateId format'),
  resumeId: z.string().uuid('Invalid resumeId format').optional().nullable(),
  stage: z.string().min(1).max(100).optional().default('Resume Screening'),
});

export const UpdateApplicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${APPLICATION_STATUSES.join(', ')}` }),
  }),
  stage: z.string().min(1).max(100).optional(),
});

const EvidenceFindingSchema = z.object({
  title: z.string().min(1).max(200),
  status: z.enum([
    'demonstrated',
    'partial',
    'not_evidenced',
    'insufficient_evidence',
    'not_applicable',
  ]),
  summary: z.string().min(1).max(3000),
  resumeEvidence: z.array(z.string().max(2000)).max(20),
  jobEvidence: z.array(z.string().max(2000)).max(20),
  confidence: z.enum(['high', 'medium', 'low']),
});

const SkillAssessmentSchema = EvidenceFindingSchema.extend({
  skill: z.string().min(1).max(200),
});

export const ResumeMatchReportSchema = z.object({
  matchScore: z.number().min(0).max(100).nullable(),
  analysisConfidence: z.enum(['high', 'medium', 'low']),
  insufficientInformation: z.boolean(),
  fitSummary: z.string().min(1).max(5000),
  requiredSkills: z.array(SkillAssessmentSchema).max(100),
  preferredSkills: z.array(SkillAssessmentSchema).max(100),
  experienceAssessment: EvidenceFindingSchema,
  projectAssessments: z.array(EvidenceFindingSchema).max(50),
  educationAssessment: EvidenceFindingSchema,
  missingQualifications: z.array(EvidenceFindingSchema).max(50),
  strengths: z.array(EvidenceFindingSchema).max(50),
  gaps: z.array(EvidenceFindingSchema).max(50),
  suggestedInterviewTopics: z.array(z.string().min(1).max(500)).max(30),
});

export const ResumeScreeningResultSchema = z.object({
  applicationId: z.string(),
  analysisId: z.string(),
  analyzedAt: z.string().datetime(),
  report: ResumeMatchReportSchema,
});

export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;
export type UpdateApplicationStatusInput = z.infer<typeof UpdateApplicationStatusSchema>;
export type ResumeMatchReport = z.infer<typeof ResumeMatchReportSchema>;
export type ResumeScreeningResult = z.infer<typeof ResumeScreeningResultSchema>;
