import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/types/index.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  CreateApplicationSchema,
  UpdateApplicationStatusSchema,
} from './applications.schemas.js';
import {
  createApplication,
  listApplications,
  getApplication,
  updateApplicationStatus,
} from './applications.service.js';
import { screenApplication } from './applications.screening.service.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.params.orgId;
  if (!orgId) throw AppError.badRequest('Organization ID is required');

  const parsed = CreateApplicationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.unprocessable(
      'Validation failed',
      parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    );
  }

  const application = await createApplication(orgId, parsed.data);
  res.status(201).json({ success: true, data: application });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.params.orgId;
  if (!orgId) throw AppError.badRequest('Organization ID is required');

  const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;
  const candidateId = typeof req.query.candidateId === 'string' ? req.query.candidateId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  const applications = await listApplications(orgId, { jobId, candidateId, status });
  res.status(200).json({ success: true, data: applications });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, applicationId } = req.params;
  if (!orgId || !applicationId) {
    throw AppError.badRequest('Organization ID and Application ID are required');
  }

  const application = await getApplication(orgId, applicationId);
  res.status(200).json({ success: true, data: application });
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, applicationId } = req.params;
  if (!orgId || !applicationId) {
    throw AppError.badRequest('Organization ID and Application ID are required');
  }

  const parsed = UpdateApplicationStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.unprocessable(
      'Validation failed',
      parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    );
  }

  const updated = await updateApplicationStatus(orgId, applicationId, parsed.data);
  res.status(200).json({ success: true, data: updated });
});

export const screen = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, applicationId } = req.params;
  if (!orgId || !applicationId) {
    throw AppError.badRequest('Organization ID and Application ID are required');
  }

  const result = await screenApplication(orgId, applicationId);
  res.status(200).json({ success: true, data: result });
});
