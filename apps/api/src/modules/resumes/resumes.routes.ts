// ---------------------------------------------------------------------------
// Resumes routes — nested under /:candidateId/resumes from candidates router
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.middleware.js';
import { authorize } from '../../middleware/authorize.middleware.js';
import { Permission } from '../rbac/permissions.js';
import { uploadMiddleware, uploadHandler, list, remove } from './resumes.controller.js';

// mergeParams: true so that :orgId and :candidateId from parent router are available
const resumesRouter = Router({ mergeParams: true });

// All routes require authentication
resumesRouter.use(authenticate);

resumesRouter.get(
  '/',
  authorize(Permission.RESUME_READ),
  list,
);

resumesRouter.post(
  '/',
  authorize(Permission.RESUME_UPLOAD),
  uploadMiddleware,
  uploadHandler,
);

resumesRouter.delete(
  '/:resumeId',
  authorize(Permission.RESUME_DELETE),
  remove,
);

export default resumesRouter;
