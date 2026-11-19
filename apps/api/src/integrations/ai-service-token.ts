import { SignJWT } from 'jose';
import { env } from '../config/env.js';

export const AI_SERVICE_TOKEN_ALGORITHM = 'HS256';
export const AI_SERVICE_TOKEN_ISSUER = 'aarohi-api';
export const AI_SERVICE_TOKEN_AUDIENCE = 'aarohi-ai-service';
export const AI_SERVICE_TOKEN_TTL_SECONDS = 120;

interface ServiceTokenInput {
  organizationId: string;
  scopes: string[];
  interviewId?: string;
  applicationId?: string;
}

export async function createAiServiceToken(input: ServiceTokenInput): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    org_id: input.organizationId,
    scopes: input.scopes,
    ...(input.interviewId ? { interview_id: input.interviewId } : {}),
    ...(input.applicationId ? { application_id: input.applicationId } : {}),
  };

  return new SignJWT(claims)
    .setProtectedHeader({ alg: AI_SERVICE_TOKEN_ALGORITHM, typ: 'JWT' })
    .setIssuer(AI_SERVICE_TOKEN_ISSUER)
    .setAudience(AI_SERVICE_TOKEN_AUDIENCE)
    .setSubject('ai-recruiter-backend')
    .setIssuedAt(now)
    .setExpirationTime(now + AI_SERVICE_TOKEN_TTL_SECONDS)
    .sign(new TextEncoder().encode(env.AI_SERVICE_SECRET));
}
