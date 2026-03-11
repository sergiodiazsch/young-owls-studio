/**
 * Simple in-memory rate limiter for single-instance deployment (no Redis needed).
 *
 * Usage:
 *   const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });
 *   const { success, remaining } = limiter.check(5, ip);
 */

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

export function rateLimit(options: {
  interval: number;
  uniqueTokenPerInterval: number;
}) {
  const tokenCache = new Map<string, number[]>();

  return {
    check(limit: number, token: string): RateLimitResult {
      const now = Date.now();
      const windowStart = now - options.interval;
      const tokenCount = tokenCache.get(token) || [];
      const validTokens = tokenCount.filter((t) => t > windowStart);

      if (validTokens.length >= limit) {
        return { success: false, remaining: 0 };
      }

      validTokens.push(now);
      tokenCache.set(token, validTokens);

      // Cleanup old entries periodically
      if (tokenCache.size > options.uniqueTokenPerInterval) {
        const entries = Array.from(tokenCache.entries());
        for (const [key, timestamps] of entries) {
          const valid = timestamps.filter((t) => t > windowStart);
          if (valid.length === 0) tokenCache.delete(key);
          else tokenCache.set(key, valid);
        }
      }

      return { success: true, remaining: limit - validTokens.length };
    },
  };
}
