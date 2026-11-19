import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/types/index.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  CreateJobSchema,
  UpdateJobSchema,
  UpdateJobStatusSchema,
} from './jobs.schemas.js';
import {
  createJob,
  listJobs,
  getJob,
  updateJob,
  updateJobStatus,
  deleteJob,
} from './jobs.service.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const orgId = req.params.orgId;
  if (!orgId) throw AppError.badRequest('Organization ID is required');

  const parsed = CreateJobSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.unprocessable('Validation failed', parsed.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    })));
  }

  const job = await createJob(orgId, authReq.user!.sub, parsed.data);
  res.status(201).json({ success: true, data: job });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.params.orgId;
  if (!orgId) throw AppError.badRequest('Organization ID is required');

  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  const jobs = await listJobs(orgId, { status, search });
  res.status(200).json({ success: true, data: jobs });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, jobId } = req.params;
  if (!orgId || !jobId) throw AppError.badRequest('Organization ID and Job ID are required');

  const job = await getJob(orgId, jobId);
  res.status(200).json({ success: true, data: job });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, jobId } = req.params;
  if (!orgId || !jobId) throw AppError.badRequest('Organization ID and Job ID are required');

  const parsed = UpdateJobSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.unprocessable('Validation failed', parsed.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    })));
  }

  const job = await updateJob(orgId, jobId, parsed.data);
  res.status(200).json({ success: true, data: job });
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, jobId } = req.params;
  if (!orgId || !jobId) throw AppError.badRequest('Organization ID and Job ID are required');

  const parsed = UpdateJobStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.unprocessable('Validation failed', parsed.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    })));
  }

  const job = await updateJobStatus(orgId, jobId, parsed.data.status);
  res.status(200).json({ success: true, data: job });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, jobId } = req.params;
  if (!orgId || !jobId) throw AppError.badRequest('Organization ID and Job ID are required');

  await deleteJob(orgId, jobId);
  res.status(200).json({ success: true, data: null });
});
