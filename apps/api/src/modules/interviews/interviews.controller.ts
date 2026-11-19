import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/types/index.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  CreateInterviewSchema,
  UpdateInterviewSchema,
  RecruiterDecisionSchema,
  ListInterviewsQuerySchema,
  ConsentSchema,
  RecordEventSchema,
  RegenerateTokenSchema,
  RecordAnswerSchema,
} from './interviews.schemas.js';
import * as svc from './interviews.service.js';

// ---------------------------------------------------------------------------
// Recruiter-facing handlers (authenticated, org-scoped)
// ---------------------------------------------------------------------------

export async function createInterview(req: Request, res: Response): Promise<void> {
  const user = (req as AuthenticatedRequest).user;
  const orgId = req.params.orgId;
  const body = CreateInterviewSchema.parse(req.body);

  const result = await svc.createInterview(orgId, user.sub, body);

  res.status(201).json({
    success: true,
    data: {
      interview: result.interview,
      inviteUrl: result.inviteUrl,
      // rawToken returned once so recruiter can copy the URL — never stored
      accessToken: result.rawToken,
    },
  });
}

export async function createInterviewAttempt(req: Request, res: Response): Promise<void> {
  const user = (req as AuthenticatedRequest).user;
  const { orgId, interviewId } = req.params;
  const result = await svc.createInterviewAttempt(orgId, user.sub, interviewId);

  res.status(201).json({
    success: true,
    data: {
      interview: result.interview,
      inviteUrl: result.inviteUrl,
      accessToken: result.rawToken,
    },
  });
}

export async function listInterviews(req: Request, res: Response): Promise<void> {
  const orgId = req.params.orgId;
  const query = ListInterviewsQuerySchema.parse(req.query);
  const result = await svc.listInterviews(orgId, query);

  res.status(200).json({ success: true, ...result });
}

export async function getInterview(req: Request, res: Response): Promise<void> {
  const orgId = req.params.orgId;
  const { interviewId } = req.params;
  const data = await svc.getInterview(orgId, interviewId);
  res.status(200).json({ success: true, data });
}

export async function updateInterview(req: Request, res: Response): Promise<void> {
  const orgId = req.params.orgId;
  const { interviewId } = req.params;
  const body = UpdateInterviewSchema.parse(req.body);
  const data = await svc.updateInterview(orgId, interviewId, body);
  res.status(200).json({ success: true, data });
}

export async function recordDecision(req: Request, res: Response): Promise<void> {
  const user = (req as AuthenticatedRequest).user;
  const orgId = req.params.orgId;
  const { interviewId } = req.params;
  const body = RecruiterDecisionSchema.parse(req.body);
  const data = await svc.recordDecision(orgId, interviewId, user.sub, body);
  res.status(200).json({ success: true, data });
}

export async function regenerateToken(req: Request, res: Response): Promise<void> {
  const orgId = req.params.orgId;
  const { interviewId } = req.params;
  const body = RegenerateTokenSchema.safeParse(req.body);
  const expiryHours = body.success ? body.data.expiryHours : undefined;
  const result = await svc.regenerateToken(orgId, interviewId, expiryHours);

  res.status(200).json({
    success: true,
    data: {
      inviteUrl: result.inviteUrl,
      accessToken: result.rawToken,
      expiresAt: result.expiresAt,
    },
  });
}

export async function sendInvite(req: Request, res: Response): Promise<void> {
  const orgId = req.params.orgId;
  const { interviewId } = req.params;
  const recipientEmail = req.body?.recipientEmail ? String(req.body.recipientEmail) : undefined;

  const result = await svc.sendInterviewInvite(orgId, interviewId, recipientEmail);
  res.status(200).json({
    success: true,
    data: {
      emailSent: true,
      messageId: result.messageId,
      recipient: result.to,
      inviteUrl: result.inviteUrl,
    },
  });
}

// ---------------------------------------------------------------------------
// Public candidate-facing handlers (no authentication)
// ---------------------------------------------------------------------------

export async function validateToken(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  if (!token || token.length !== 64) throw AppError.badRequest('Invalid token format');

  const result = await svc.validateAccessToken(token);
  if (!result) throw AppError.unauthorized('Invalid, expired, or revoked interview token');

  res.status(200).json({ success: true, data: result });
}

export async function recordConsent(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  if (!token || token.length !== 64) throw AppError.badRequest('Invalid token format');

  const body = ConsentSchema.parse(req.body);
  await svc.recordConsent(token, {
    ...body,
    ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.status(204).send();
}

export async function recordEvent(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  if (!token || token.length !== 64) throw AppError.badRequest('Invalid token format');

  const body = RecordEventSchema.parse(req.body);
  await svc.recordEvent(token, body);
  res.status(204).send();
}

export async function recordAnswer(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  if (!token || token.length !== 64) throw AppError.badRequest('Invalid token format');

  const body = RecordAnswerSchema.parse(req.body);
  const data = await svc.submitCandidateAnswer(token, body);
  res.status(200).json({ success: true, data });
}

export async function startCandidateInterview(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  if (!token || token.length !== 64) throw AppError.badRequest('Invalid token format');

  const data = await svc.startCandidateInterview(token);
  res.status(200).json({ success: true, data });
}

export async function getLiveKitToken(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  if (!token || token.length !== 64) throw AppError.badRequest('Invalid token format');

  const data = await svc.getLiveKitToken(token);
  res.status(200).json({ success: true, data });
}
