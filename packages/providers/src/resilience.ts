/** Timeout, retry (exponential backoff + jitter), and circuit breaker. */

import { ProviderError, isProviderError } from './errors';

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Injectable for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
  jitter?: () => number; // 0..1
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  const jitter = opts.jitter ?? (() => Math.random());
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = isProviderError(err) ? err.retryable : true;
      if (!retryable || attempt === opts.retries) break;
      const backoff = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** attempt);
      const delay = backoff / 2 + backoff * 0.5 * jitter();
      await sleep(delay);
    }
  }
  throw lastErr;
}

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
  provider: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ProviderError('timeout', provider, `Timed out after ${ms}ms`, {
        retryable: true,
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export type BreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  failureThreshold: number; // consecutive failures before opening
  cooldownMs: number; // time before a half-open probe
  now?: () => number; // injectable clock
}

export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private readonly now: () => number;
  lastError?: string;

  constructor(private readonly opts: CircuitBreakerOptions) {
    this.now = opts.now ?? (() => Date.now());
  }

  get currentState(): BreakerState {
    if (this.state === 'open' && this.now() - this.openedAt >= this.opts.cooldownMs) {
      this.state = 'half_open';
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>, provider: string): Promise<T> {
    const state = this.currentState;
    if (state === 'open') {
      throw new ProviderError('circuit_open', provider, 'Circuit is open', {
        retryable: false,
      });
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastError = undefined;
  }

  private onFailure(err: unknown): void {
    this.failures += 1;
    this.lastError = err instanceof Error ? err.message : String(err);
    if (this.state === 'half_open' || this.failures >= this.opts.failureThreshold) {
      this.state = 'open';
      this.openedAt = this.now();
    }
  }
}
