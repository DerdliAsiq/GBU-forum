import { describe, expect, it, vi } from "vitest";
import { likePattern, parsePaging } from "./query";
import { RateLimiter } from "./rateLimit";

describe("parsePaging", () => {
  it("uses defaults", () => {
    expect(parsePaging({})).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it("clamps bad and huge input instead of erroring", () => {
    expect(parsePaging({ page: "0", limit: "-1" })).toEqual({ page: 1, limit: 20, offset: 0 });
    expect(parsePaging({ page: "abc", limit: "100000" })).toEqual({ page: 1, limit: 50, offset: 0 });
    expect(parsePaging({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10, offset: 20 });
  });
});

describe("likePattern", () => {
  it("escapes LIKE wildcards so user input matches literally", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("RateLimiter", () => {
  it("blocks after max hits and resets after the window", () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.hit("a")).toBe(0);
    expect(limiter.hit("a")).toBe(0);
    expect(limiter.hit("a")).toBeGreaterThan(0);
    expect(limiter.hit("b")).toBe(0); // separate key, separate bucket
    vi.advanceTimersByTime(1001);
    expect(limiter.hit("a")).toBe(0);
    vi.useRealTimers();
  });

  it("check() reports without counting; reset() clears", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.check("k")).toBe(0);
    limiter.hit("k");
    expect(limiter.check("k")).toBeGreaterThan(0);
    expect(limiter.check("k")).toBeGreaterThan(0);
    limiter.reset("k");
    expect(limiter.check("k")).toBe(0);
  });
});
