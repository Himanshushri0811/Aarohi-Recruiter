// ---------------------------------------------------------------------------
// Candidates — Zod validation schemas
// ---------------------------------------------------------------------------
import { z } from 'zod';

export const CreateCandidateSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Must be a valid email address'),
  phone: z.string().optional(),
  location: z.string().optional(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(z.string()).default([]),
  experienceYears: z.number().optional(),
});

export const UpdateCandidateSchema = CreateCandidateSchema.partial();

export type CreateCandidateInput = z.infer<typeof CreateCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof UpdateCandidateSchema>;
