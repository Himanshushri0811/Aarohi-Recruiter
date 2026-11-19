import { Request, Response } from 'express';
import { AppErrorDetail } from '../errors/app-error.js';

// ---------------------------------------------------------------------------
// Generic API response shapes
// ---------------------------------------------------------------------------

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: AppErrorDetail[];
    requestId?: string;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

// ---------------------------------------------------------------------------
// Extended Express request types
// ---------------------------------------------------------------------------

export interface RequestWithId extends Request {
  requestId: string;
}

export interface TenantContext {
  organizationId: string;
  organizationSlug: string;
}

export interface AuthPayload {
  sub: string;              // User ID
  email: string;
  organizationId?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends RequestWithId {
  user: AuthPayload;
  tenant?: TenantContext;
}

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

export type TypedRequestHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  Query = Record<string, string>,
> = (
  req: Request<P, ResBody, ReqBody, Query>,
  res: Response<ApiResponse<ResBody>>,
) => Promise<void> | void;

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs?: number;
  error?: string;
}

export interface HealthResponse {
  status: 'alive' | 'ready' | 'degraded';
  version: string;
  environment: string;
  timestamp: string;
  checks?: Record<string, HealthCheckResult>;
}
