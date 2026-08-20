// In-memory token bucket per (form, ip). Fine for a single instance; ARCHITECTURE.md
// accepts this tradeoff explicitly (no Redis, no external queue).
type Bucket = { tokens: number; updatedAt: number }

export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>()
  private lastSweep = Date.now()

  consume(key: string, perMinute: number, burst: number, now = Date.now()): boolean {
    this.sweep(now)
    const ratePerMs = perMinute / 60_000
    const existing = this.buckets.get(key)
    const bucket: Bucket = existing ?? { tokens: burst, updatedAt: now }
    const elapsed = Math.max(0, now - bucket.updatedAt)
    bucket.tokens = Math.min(burst, bucket.tokens + elapsed * ratePerMs)
    bucket.updatedAt = now
    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket)
      return false
    }
    bucket.tokens -= 1
    this.buckets.set(key, bucket)
    return true
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return
    this.lastSweep = now
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt > 10 * 60_000) this.buckets.delete(key)
    }
  }
}
