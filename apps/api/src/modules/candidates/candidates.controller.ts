// ---------------------------------------------------------------------------
// Candidates controller
// ---------------------------------------------------------------------------
import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { AppError } from '../../common/errors/app-error.js';
import { CreateCandidateSchema, UpdateCandidateSchema } from './candidates.schemas.js';
import {
  createCandidate,
  listCandidates,
  getCandidate,
  updateCandidate,
  archiveCandidate,
} from './candidates.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseZod<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { errors: { path: (string | number)[]; message: string }[] } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw AppError.unprocessable(
      'Validation failed',
      result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.params.orgId;
  if (!orgId) throw AppError.badRequest('Organization ID is required');

  const input = parseZod(CreateCandidateSchema, req.body);
  const candidate = await createCandidate(orgId, input);
  res.status(201).json({ success: true, data: candidate });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.params.orgId;
  if (!orgId) throw AppError.badRequest('Organization ID is required');

  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  const candidates = await listCandidates(orgId, { status, search });
  res.status(200).json({ success: true, data: candidates });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, candidateId } = req.params;
  if (!orgId || !candidateId) {
    throw AppError.badRequest('Organization ID and Candidate ID are required');
  }

  const candidate = await getCandidate(orgId, candidateId);
  res.status(200).json({ success: true, data: candidate });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, candidateId } = req.params;
  if (!orgId || !candidateId) {
    throw AppError.badRequest('Organization ID and Candidate ID are required');
  }

  const input = parseZod(UpdateCandidateSchema, req.body);
  const candidate = await updateCandidate(orgId, candidateId, input);
  res.status(200).json({ success: true, data: candidate });
});

export const archive = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, candidateId } = req.params;
  if (!orgId || !candidateId) {
    throw AppError.badRequest('Organization ID and Candidate ID are required');
  }

  const candidate = await archiveCandidate(orgId, candidateId);
  res.status(200).json({ success: true, data: candidate });
});
