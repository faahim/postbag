import { createHash, randomBytes } from "node:crypto"

/**
 * Job K — plan_grants codes: shown once, stored hashed, same discipline as an API key.
 * 24 random bytes -> 32 URL-safe base64 characters (well over the spec's 16+ minimum).
 */
export function generateGrantCode(): string {
  return randomBytes(24).toString("base64url")
}

export function hashGrantCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex")
}
