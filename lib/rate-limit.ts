import "server-only";

const buckets = new Map<string, { count: number; reset: number }>();

/**
 * Tiny fixed-window limiter for LLM-backed routes. In-memory per instance —
 * good enough to stop accidental hammering; swap for Upstash/Redis at scale.
 * When the limit trips, routes fall back to the offline engine instead of erroring.
 */
export function allowLlmCall(req: Request, limit = Number(process.env.LLM_RATE_LIMIT) || 30, windowMs = 10 * 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.reset < now) {
    buckets.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}
