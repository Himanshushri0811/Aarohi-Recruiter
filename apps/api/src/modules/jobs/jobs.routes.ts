import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.middleware.js';
import { authorize } from '../../middleware/authorize.middleware.js';
import { Permission } from '../rbac/permissions.js';
import { create, list, get, update, updateStatus, remove } from './jobs.controller.js';

const jobsRouter = Router({ mergeParams: true });

// All routes require authentication
jobsRouter.use(authenticate);

jobsRouter.get('/', authorize(Permission.JOB_READ), list);
jobsRouter.post('/', authorize(Permission.JOB_CREATE), create);
jobsRouter.get('/:jobId', authorize(Permission.JOB_READ), get);
jobsRouter.put('/:jobId', authorize(Permission.JOB_UPDATE), update);
jobsRouter.patch('/:jobId/status', authorize(Permission.JOB_UPDATE), updateStatus);
jobsRouter.delete('/:jobId', authorize(Permission.JOB_DELETE), remove);

export default jobsRouter;
