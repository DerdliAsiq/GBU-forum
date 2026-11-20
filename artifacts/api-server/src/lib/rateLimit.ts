import type { Request, RequestHandler, Response } from "express";

/**
 * Fixed-window, in-memory rate limiter.
 *
 * State lives in this process only: counters reset on restart and are not
 * shared between instances. That is enough for a single API instance; move to
 * a shared store (Redis, Postgres) before scaling out.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {
    setInterval(() => this.sweep(), Math.max(windowMs, 60_000)).unref();
  }

  /** Counts one hit for `key`; returns seconds to wait when over the limit, else 0. */
  hit(key: string): number {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count++;
    return bucket.count > this.max ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

/**
 * Client address used as the limiter key. Behind a reverse proxy this is only
 * the real client when `TRUST_PROXY` is set (see app.ts).
 */
export function clientKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function sendTooMany(res: Response, retryAfterSeconds: number): void {
  res.set("Retry-After", String(retryAfterSeconds));
  res.status(429).json({ error: "Çox sayda sorğu. Bir az sonra yenidən cəhd edin" });
}

/** Middleware: at most `max` requests per client address per `windowMs`. */
export function rateLimit(max: number, windowMs: number): RequestHandler {
  const limiter = new RateLimiter(max, windowMs);
  return (req, res, next) => {
    const wait = limiter.hit(clientKey(req));
    if (wait) {
      sendTooMany(res, wait);
      return;
    }
    next();
  };
}
