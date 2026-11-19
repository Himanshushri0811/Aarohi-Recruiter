import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.middleware.js';
import { authorize } from '../../middleware/authorize.middleware.js';
import { Permission } from '../rbac/permissions.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import * as ctrl from './interviews.controller.js';

// mergeParams: true so :orgId from parent router is available
const router = Router({ mergeParams: true });

// List & Create
router.get('/', authenticate, authorize(Permission.INTERVIEW_READ), asyncHandler(ctrl.listInterviews));
router.post('/', authenticate, authorize(Permission.INTERVIEW_CREATE), asyncHandler(ctrl.createInterview));
router.post('/:interviewId/attempt', authenticate, authorize(Permission.INTERVIEW_CREATE), asyncHandler(ctrl.createInterviewAttempt));

// Single interview operations
router.get('/:interviewId', authenticate, authorize(Permission.INTERVIEW_READ), asyncHandler(ctrl.getInterview));
router.put('/:interviewId', authenticate, authorize(Permission.INTERVIEW_UPDATE), asyncHandler(ctrl.updateInterview));

// Recruiter decision
router.post('/:interviewId/decision', authenticate, authorize(Permission.INTERVIEW_UPDATE), asyncHandler(ctrl.recordDecision));

// Regenerate invite token
router.post('/:interviewId/regenerate-token', authenticate, authorize(Permission.INTERVIEW_UPDATE), asyncHandler(ctrl.regenerateToken));

// Send Brevo invite email
router.post('/:interviewId/send-invite', authenticate, authorize(Permission.INTERVIEW_UPDATE), asyncHandler(ctrl.sendInvite));

export default router;
