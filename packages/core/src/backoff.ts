export type BackoffOptions = {
  readonly base?: number
  readonly max?: number
  readonly jitterRatio?: number
}

const DEFAULT_BASE_MS = 30_000
const DEFAULT_MAX_MS = 6 * 60 * 60 * 1_000
const DEFAULT_JITTER_RATIO = 0.2

export function nextAttemptAt(
  attempts: number,
  now: Date,
  options: BackoffOptions,
  rng: () => number,
): Date {
  const base = options.base ?? DEFAULT_BASE_MS
  const max = options.max ?? DEFAULT_MAX_MS
  const jitterRatio = options.jitterRatio ?? DEFAULT_JITTER_RATIO
  const boundedAttempts = Math.max(0, Math.floor(attempts))
  const delay = Math.min(base * 2 ** boundedAttempts, max)
  const normalizedRandom = Math.min(1, Math.max(0, rng()))
  const jitter = delay * jitterRatio * (normalizedRandom * 2 - 1)
  return new Date(now.getTime() + Math.round(delay + jitter))
}

export function maxAttemptsFor(destinationType: string): number {
  switch (destinationType) {
    case "webhook":
      return 10
    case "email":
    case "telegram":
    default:
      return 8
  }
}
