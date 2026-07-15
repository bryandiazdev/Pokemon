/**
 * Provider registry: resolves each capability to a configured adapter, with a
 * per-(provider,capability) circuit breaker, timeout, retry, usage logging, and
 * an optional cache. Fallback providers can be registered per capability.
 */

import type {
  Capability,
  ProviderCapabilities,
  ProviderHealth,
} from './interfaces';
import { CircuitBreaker, withRetry, withTimeout } from './resilience';
import { ProviderError } from './errors';

export interface ProviderRequestLog {
  provider: string;
  operation: string;
  status: 'success' | 'error';
  durationMs: number;
  cacheHit: boolean;
  creditsUsed?: number;
  errorCode?: string;
}

export interface UsageSink {
  record(log: ProviderRequestLog): void;
}

export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

export interface RegistryOptions {
  timeoutMs?: number;
  retries?: number;
  failureThreshold?: number;
  cooldownMs?: number;
  usageSink?: UsageSink;
  cache?: Cache;
  now?: () => number;
}

interface Registered {
  primary: ProviderCapabilities;
  fallbacks: ProviderCapabilities[];
}

export class ProviderRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();
  private registered: Registered = { primary: {}, fallbacks: [] };
  private readonly opts: Required<Omit<RegistryOptions, 'usageSink' | 'cache' | 'now'>> &
    Pick<RegistryOptions, 'usageSink' | 'cache' | 'now'>;

  constructor(options: RegistryOptions = {}) {
    this.opts = {
      timeoutMs: options.timeoutMs ?? 8000,
      retries: options.retries ?? 2,
      failureThreshold: options.failureThreshold ?? 5,
      cooldownMs: options.cooldownMs ?? 30_000,
      usageSink: options.usageSink,
      cache: options.cache,
      now: options.now,
    };
  }

  setPrimary(caps: ProviderCapabilities): this {
    this.registered.primary = caps;
    return this;
  }
  addFallback(caps: ProviderCapabilities): this {
    this.registered.fallbacks.push(caps);
    return this;
  }

  private breakerFor(provider: string, capability: Capability): CircuitBreaker {
    const key = `${provider}:${capability}`;
    let b = this.breakers.get(key);
    if (!b) {
      b = new CircuitBreaker({
        failureThreshold: this.opts.failureThreshold,
        cooldownMs: this.opts.cooldownMs,
        now: this.opts.now,
      });
      this.breakers.set(key, b);
    }
    return b;
  }

  /** Ordered list of adapters (primary first, then fallbacks) for a capability. */
  private chain<K extends Capability>(capability: K): NonNullable<ProviderCapabilities[K]>[] {
    const out: NonNullable<ProviderCapabilities[K]>[] = [];
    const p = this.registered.primary[capability];
    if (p) out.push(p as NonNullable<ProviderCapabilities[K]>);
    for (const f of this.registered.fallbacks) {
      const c = f[capability];
      if (c) out.push(c as NonNullable<ProviderCapabilities[K]>);
    }
    return out;
  }

  /**
   * Invoke a capability method through the resilience chain, trying fallbacks in
   * order when a provider's breaker is open or the call fails hard.
   */
  async call<K extends Capability, T>(
    capability: K,
    operation: string,
    invoke: (adapter: NonNullable<ProviderCapabilities[K]>) => Promise<T>,
    cacheOpts?: { key: string; ttlSeconds: number },
  ): Promise<T> {
    if (cacheOpts && this.opts.cache) {
      const cached = await this.opts.cache.get<T>(cacheOpts.key);
      if (cached !== undefined) {
        this.log({ provider: 'cache', operation, status: 'success', durationMs: 0, cacheHit: true });
        return cached;
      }
    }

    const adapters = this.chain(capability);
    if (adapters.length === 0) {
      throw new ProviderError('unavailable', capability, `No provider registered for ${capability}`);
    }

    let lastErr: unknown;
    for (const adapter of adapters) {
      const provider = (adapter as { name: string }).name;
      const breaker = this.breakerFor(provider, capability);
      const started = this.opts.now?.() ?? Date.now();
      try {
        const result = await breaker.execute(
          () =>
            withRetry(
              () => withTimeout(() => invoke(adapter), this.opts.timeoutMs, provider),
              { retries: this.opts.retries, baseDelayMs: 200, maxDelayMs: 2000 },
            ),
          provider,
        );
        this.log({
          provider,
          operation,
          status: 'success',
          durationMs: (this.opts.now?.() ?? Date.now()) - started,
          cacheHit: false,
        });
        if (cacheOpts && this.opts.cache) {
          await this.opts.cache.set(cacheOpts.key, result, cacheOpts.ttlSeconds);
        }
        return result;
      } catch (err) {
        lastErr = err;
        this.log({
          provider,
          operation,
          status: 'error',
          durationMs: (this.opts.now?.() ?? Date.now()) - started,
          cacheHit: false,
          errorCode: err instanceof ProviderError ? err.code : 'unknown',
        });
        // Try the next fallback adapter.
      }
    }
    throw lastErr;
  }

  health(): ProviderHealth[] {
    const out: ProviderHealth[] = [];
    for (const [key, breaker] of this.breakers) {
      const [provider, capability] = key.split(':') as [string, Capability];
      const state = breaker.currentState;
      out.push({
        provider,
        capability,
        state,
        healthy: state === 'closed',
        lastError: breaker.lastError,
        lastCheckedAt: new Date(this.opts.now?.() ?? Date.now()).toISOString(),
      });
    }
    return out;
  }

  private log(entry: ProviderRequestLog): void {
    this.opts.usageSink?.record(entry);
  }
}
