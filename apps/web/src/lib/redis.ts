import 'server-only';
import { env } from './env';
import type { Lock, LockHandle } from './jobs/types';

/**
 * Minimal Upstash Redis REST client + a distributed lock. When Redis is not
 * configured, `getLock()` returns an in-process lock so jobs still run safely in
 * single-instance/demo setups (with a clear caveat: it is NOT cross-instance).
 */

async function redisCommand(command: (string | number)[]): Promise<unknown> {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Redis command failed: ${res.status}`);
  const body = (await res.json()) as { result?: unknown };
  return body.result;
}

export const hasRedis = (): boolean =>
  Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

/** Redis-backed lock: SET key token NX PX ttl; release compares token (Lua). */
class RedisLock implements Lock {
  async acquire(key: string, ttlMs: number): Promise<LockHandle | null> {
    const token = globalThis.crypto.randomUUID();
    const result = await redisCommand(['SET', `lock:${key}`, token, 'NX', 'PX', ttlMs]);
    if (result !== 'OK') return null;
    return {
      async release() {
        // Only release if we still own the lock.
        await redisCommand([
          'EVAL',
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          `lock:${key}`,
          token,
        ]);
      },
    };
  }
}

/** In-process fallback lock (single instance only). */
class MemoryLock implements Lock {
  private held = new Map<string, number>();
  async acquire(key: string, ttlMs: number): Promise<LockHandle | null> {
    const now = Date.now();
    const expiry = this.held.get(key);
    if (expiry && expiry > now) return null;
    this.held.set(key, now + ttlMs);
    return {
      release: async () => {
        this.held.delete(key);
      },
    };
  }
}

const memoryLock = new MemoryLock();

export function getLock(): Lock {
  return hasRedis() ? new RedisLock() : memoryLock;
}
