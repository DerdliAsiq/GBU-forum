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

  /** Seconds to wait if `key` is already over the limit, else 0. Does not count a hit. */
  check(key: string): number {
    const bucket = this.buckets.get(key);
    const now = Date.now();
    if (!bucket || bucket.resetAt <= now || bucket.count < this.max) return 0;
    return Math.ceil((bucket.resetAt - now) / 1000);
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
 * Header carrying the real client IP, set by the edge proxy. Render sits behind
 * Cloudflare, which always overwrites `CF-Connecting-IP` with the connecting
 * client's address, so a visitor cannot spoof it. Only honour such a header
 * when it is configured AND the app is reachable solely through that proxy.
 */
const CLIENT_IP_HEADER = process.env.CLIENT_IP_HEADER?.trim().toLowerCase() || "";

/**
 * Client address used as the limiter key. Without CLIENT_IP_HEADER this is
 * req.ip, which behind a proxy is only the real client when `TRUST_PROXY`
 * matches the number of hops (see app.ts) — otherwise every visitor shares the
 * proxy's address and therefore one rate-limit bucket.
 */
export function clientKey(req: Request): string {
  reportIpSourceOnce(req);
  if (CLIENT_IP_HEADER) {
    const value = req.headers[CLIENT_IP_HEADER];
    const ip = (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim();
    if (ip) return ip;
  }
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

let reportedIpSource = false;
/** Logs once (without any address) where client IPs are coming from, to verify the proxy setup. */
export function reportIpSourceOnce(req: Request): void {
  if (reportedIpSource) return;
  reportedIpSource = true;
  const xff = req.headers["x-forwarded-for"];
  req.log.info(
    {
      clientIpHeader: CLIENT_IP_HEADER || null,
      clientIpHeaderPresent: CLIENT_IP_HEADER ? req.headers[CLIENT_IP_HEADER] != null : null,
      cfConnectingIpPresent: req.headers["cf-connecting-ip"] != null,
      trueClientIpPresent: req.headers["true-client-ip"] != null,
      forwardedForHops: typeof xff === "string" ? xff.split(",").length : 0,
    },
    "Client IP source",
  );
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
