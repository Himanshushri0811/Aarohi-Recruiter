// ---------------------------------------------------------------------------
// AppError — structured operational error class
// ---------------------------------------------------------------------------

export type ErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'EMAIL_NOT_VERIFIED';

export interface AppErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: AppErrorDetail[];

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    details?: AppErrorDetail[],
    isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper prototype chain in transpiled code
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  // ---------------------------------------------------------------------------
  // Static factories — standard HTTP errors
  // ---------------------------------------------------------------------------

  static notFound(message = 'Resource not found', details?: AppErrorDetail[]): AppError {
    return new AppError(message, 404, 'NOT_FOUND', details);
  }

  static unauthorized(message = 'Authentication required', details?: AppErrorDetail[]): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED', details);
  }

  static forbidden(message = 'Access denied', details?: AppErrorDetail[]): AppError {
    return new AppError(message, 403, 'FORBIDDEN', details);
  }

  static emailNotVerified(
    message = 'Please verify your email address before logging in',
    details?: AppErrorDetail[],
  ): AppError {
    return new AppError(message, 403, 'EMAIL_NOT_VERIFIED', details);
  }

  static badRequest(message = 'Bad request', details?: AppErrorDetail[]): AppError {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static conflict(message = 'Resource already exists', details?: AppErrorDetail[]): AppError {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static unprocessable(message = 'Validation failed', details?: AppErrorDetail[]): AppError {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }

  static rateLimited(message = 'Too many requests', details?: AppErrorDetail[]): AppError {
    return new AppError(message, 429, 'RATE_LIMITED', details);
  }

  static internal(message = 'An unexpected error occurred'): AppError {
    return new AppError(message, 500, 'INTERNAL_ERROR', undefined, false);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable'): AppError {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE', undefined, true);
  }

  // ---------------------------------------------------------------------------
  // Serialisation
  // ---------------------------------------------------------------------------

  toJSON(requestId?: string): object {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
        ...(requestId ? { requestId } : {}),
      },
    };
  }
}
