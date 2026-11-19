import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { authenticate } from '../../middleware/authenticate.middleware.js';
import { authorize } from '../../middleware/authorize.middleware.js';
import { Permission } from '../rbac/permissions.js';
import * as orgController from './organizations.controller.js';

const organizationsRouter = Router();

// All organization routes require authentication
organizationsRouter.use(authenticate);

// Create organization (creator becomes OWNER)
organizationsRouter.post('/', asyncHandler(orgController.create));

// List organizations for current user
organizationsRouter.get('/', asyncHandler(orgController.list));

// Get single organization details (requires membership and ORG_READ)
organizationsRouter.get(
  '/:orgId',
  authorize(Permission.ORG_READ),
  asyncHandler(orgController.get),
);

// Update organization details (requires membership and ORG_UPDATE)
organizationsRouter.patch(
  '/:orgId',
  authorize(Permission.ORG_UPDATE),
  asyncHandler(orgController.update),
);

export default organizationsRouter;
