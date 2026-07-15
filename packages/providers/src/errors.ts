export type ProviderErrorCode =
  | 'timeout'
  | 'rate_limited'
  | 'unauthorized'
  | 'not_found'
  | 'unavailable'
  | 'bad_response'
  | 'circuit_open'
  | 'unknown';

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider: string;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    code: ProviderErrorCode,
    provider: string,
    message: string,
    opts: { retryable?: boolean; status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = 'ProviderError';
    this.code = code;
    this.provider = provider;
    this.retryable = opts.retryable ?? DEFAULT_RETRYABLE.has(code);
    this.status = opts.status;
  }
}

const DEFAULT_RETRYABLE = new Set<ProviderErrorCode>([
  'timeout',
  'rate_limited',
  'unavailable',
]);

export function isProviderError(e: unknown): e is ProviderError {
  return e instanceof ProviderError;
}
