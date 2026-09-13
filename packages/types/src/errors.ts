/** Stable machine-readable error codes returned by the API. */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  ENTITLEMENT_REQUIRED: 'ENTITLEMENT_REQUIRED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REUSED: 'TOKEN_REUSED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  COUPON_INVALID: 'COUPON_INVALID',
  ALREADY_SETTLED: 'ALREADY_SETTLED',
  UNSUPPORTED_MARKET: 'UNSUPPORTED_MARKET',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYMENT_REQUIRED: 402,
  ENTITLEMENT_REQUIRED: 402,
  SUBSCRIPTION_EXPIRED: 402,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_VERIFIED: 403,
  ACCOUNT_BANNED: 403,
  TOKEN_EXPIRED: 401,
  TOKEN_REUSED: 401,
  PROVIDER_ERROR: 502,
  WEBHOOK_SIGNATURE_INVALID: 400,
  COUPON_INVALID: 422,
  ALREADY_SETTLED: 409,
  UNSUPPORTED_MARKET: 422,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/** Transport-agnostic application error carrying a stable code. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = ERROR_STATUS[code];
    this.details = details;
    this.expose = this.statusCode < 500;
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(ErrorCode.UNAUTHORIZED, message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new AppError(ErrorCode.FORBIDDEN, message);
  }
  static notFound(entity = 'Resource') {
    return new AppError(ErrorCode.NOT_FOUND, `${entity} not found`);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError(ErrorCode.CONFLICT, message, details);
  }
  static validation(message = 'Validation failed', details?: unknown) {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, details);
  }
  static entitlementRequired(product: string) {
    return new AppError(
      ErrorCode.ENTITLEMENT_REQUIRED,
      `A ${product} subscription is required to access this content`,
      { product },
    );
  }
  static internal(message = 'Internal server error', details?: unknown) {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, details);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
