import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.middleware.js';
import { authorize } from '../../middleware/authorize.middleware.js';
import { Permission } from '../rbac/permissions.js';
import { create, list, get, updateStatus, screen } from './applications.controller.js';

const applicationsRouter = Router({ mergeParams: true });

// All routes require authentication
applicationsRouter.use(authenticate);

applicationsRouter.get('/', authorize(Permission.APPLICATION_READ), list);
applicationsRouter.post('/', authorize(Permission.APPLICATION_CREATE), create);
applicationsRouter.get('/:applicationId', authorize(Permission.APPLICATION_READ), get);
applicationsRouter.patch('/:applicationId/status', authorize(Permission.APPLICATION_UPDATE), updateStatus);
applicationsRouter.post('/:applicationId/screen', authorize(Permission.APPLICATION_UPDATE), screen);

export default applicationsRouter;
