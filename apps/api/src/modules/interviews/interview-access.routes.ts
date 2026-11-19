import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../common/utils/async-handler.js';
import * as ctrl from './interviews.controller.js';

const router = Router();

// Strict rate limit for public candidate-facing endpoints
const accessLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

// GET /interview/validate/:token — validate token & return interview metadata (no PII in URL)
router.get('/validate/:token', accessLimiter, asyncHandler(ctrl.validateToken));

// POST /interview/:token/consent — record candidate consent
router.post('/:token/consent', accessLimiter, asyncHandler(ctrl.recordConsent));

// POST /interview/:token/event — record integrity telemetry events
router.post('/:token/event', accessLimiter, asyncHandler(ctrl.recordEvent));

// POST /interview/:token/answer — save the current session turn or close the attempt
router.post('/:token/answer', accessLimiter, asyncHandler(ctrl.recordAnswer));
router.post('/:token/start', accessLimiter, asyncHandler(ctrl.startCandidateInterview));

// GET /interview/:token/livekit — fetch LiveKit room name & candidate participant token
router.get('/:token/livekit', accessLimiter, asyncHandler(ctrl.getLiveKitToken));

export default router;
