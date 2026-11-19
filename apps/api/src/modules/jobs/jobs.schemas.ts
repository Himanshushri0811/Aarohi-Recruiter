import { z } from 'zod';

export const CreateJobSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  department: z.string().min(2, 'Department must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  location: z.string().optional(),
  employmentType: z
    .enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'])
    .optional()
    .default('FULL_TIME'),
  experienceLevel: z
    .enum(['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'])
    .optional()
    .default('MID'),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional().default('PUBLISHED'),
  requirements: z.string().optional(),
  responsibilities: z.string().optional(),
  skills: z.array(z.string()).optional().default([]),
});

export const UpdateJobSchema = CreateJobSchema.partial();

export const UpdateJobStatusSchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'CLOSED']),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;
export type UpdateJobStatusInput = z.infer<typeof UpdateJobStatusSchema>;
