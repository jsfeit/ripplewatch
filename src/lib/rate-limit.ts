import "server-only";

// In-memory, per-instance rate limiting — no new infrastructure to
// provision. On Vercel's serverless platform this resets on cold starts and
// isn't shared across instances, so it's a soft ceiling against casual
// abuse/scripted hammering, not a hard guarantee at scale. Good enough for
// routes that just need to stop being wide open; revisit with Upstash Redis
// if traffic ever justifies a real distributed limiter.
const buckets = new Map<string, { count: number; resetAt: number }>();

// Sweeps stale entries so the map doesn't grow unbounded across a long-lived
// instance.
function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

// Returns true if the request is allowed, false if it should be rejected.
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5_000) sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
