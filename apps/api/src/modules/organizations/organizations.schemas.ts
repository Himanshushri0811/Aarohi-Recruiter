import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().trim().min(2, 'Organization name must be at least 2 characters long').max(100),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  logoUrl: z.string().url('Invalid logo URL').optional().nullable(),
  settings: z.record(z.unknown()).optional(),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
