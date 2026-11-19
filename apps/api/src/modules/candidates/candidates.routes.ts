// ---------------------------------------------------------------------------
// Candidates routes — mounted at /api/v1/organizations/:orgId/candidates
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.middleware.js';
import { authorize } from '../../middleware/authorize.middleware.js';
import { Permission } from '../rbac/permissions.js';
import * as candidatesController from './candidates.controller.js';
import resumesRouter from '../resumes/resumes.routes.js';

const candidatesRouter = Router({ mergeParams: true });

// All routes require authentication
candidatesRouter.use(authenticate);

// Nest resumes sub-router
candidatesRouter.use('/:candidateId/resumes', resumesRouter);

// Candidates CRUD
candidatesRouter.get(
  '/',
  authorize(Permission.CANDIDATE_READ),
  candidatesController.list,
);

candidatesRouter.post(
  '/',
  authorize(Permission.CANDIDATE_CREATE),
  candidatesController.create,
);

candidatesRouter.get(
  '/:candidateId',
  authorize(Permission.CANDIDATE_READ),
  candidatesController.get,
);

candidatesRouter.put(
  '/:candidateId',
  authorize(Permission.CANDIDATE_UPDATE),
  candidatesController.update,
);

candidatesRouter.patch(
  '/:candidateId/archive',
  authorize(Permission.CANDIDATE_UPDATE),
  candidatesController.archive,
);

export default candidatesRouter;
