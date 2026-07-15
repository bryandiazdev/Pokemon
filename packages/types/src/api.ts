/** Consistent API response envelope shared by every route handler. */

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiFailure = {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Stable, machine-readable error codes. Add here; never reuse a code's meaning. */
export const API_ERROR_CODES = [
  'validation_error',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'entitlement_exceeded',
  'usage_limit_reached',
  'subscription_required',
  'provider_unavailable',
  'provider_timeout',
  'vision_unavailable',
  'payment_error',
  'internal_error',
  'unsupported_card',
  'image_rejected',
  'low_confidence',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiSuccess<T> {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

export function fail(
  code: ApiErrorCode,
  message: string,
  extra?: { fieldErrors?: Record<string, string[]>; requestId?: string },
): ApiFailure {
  return { success: false, error: { code, message, ...extra } };
}

/** Maps a stable error code to an HTTP status. */
export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  entitlement_exceeded: 402,
  usage_limit_reached: 402,
  subscription_required: 402,
  provider_unavailable: 503,
  provider_timeout: 504,
  vision_unavailable: 503,
  payment_error: 402,
  internal_error: 500,
  unsupported_card: 422,
  image_rejected: 422,
  low_confidence: 422,
};

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** Marks how fresh a datum is, so the UI can badge it honestly. */
export type DataFreshness = 'live' | 'snapshot' | 'estimated' | 'stale' | 'demo';
