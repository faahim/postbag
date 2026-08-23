import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto"
import { isIP } from "node:net"

const TOKEN_PREFIX = "pbs_"

function derivedKey(secret: string, purpose: string): Buffer {
  return createHmac("sha256", secret).update(`postbag:anonymous-sandbox:${purpose}`).digest()
}

export function keyedSandboxHash(secret: string, purpose: string, value: string): string {
  return createHmac("sha256", derivedKey(secret, purpose)).update(value).digest("base64url")
}

export function normalizeClaimEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function claimEmailHash(secret: string, email: string): string {
  return keyedSandboxHash(secret, "claim-email", normalizeClaimEmail(email))
}

export function newSandboxToken(sandboxId: string): string {
  return `${TOKEN_PREFIX}${sandboxId}.${randomBytes(32).toString("base64url")}`
}

export function sandboxIdFromToken(token: string): string | null {
  const match = /^pbs_(fm_[23456789abcdefghjkmnpqrstuvwxyz]{12})\.[A-Za-z0-9_-]{43}$/u.exec(token)
  return match?.[1] ?? null
}

export function sandboxTokenHash(secret: string, token: string): string {
  return keyedSandboxHash(secret, "token", token)
}

export function encryptSandboxToken(secret: string, token: string): string {
  const nonce = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", derivedKey(secret, "token-replay"), nonce)
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()])
  return [nonce, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".")
}

export function decryptSandboxToken(secret: string, encrypted: string): string {
  const parts = encrypted.split(".")
  if (parts.length !== 3) throw new Error("Invalid encrypted sandbox token.")
  const [nonceText, tagText, ciphertextText] = parts
  if (nonceText === undefined || tagText === undefined || ciphertextText === undefined) {
    throw new Error("Invalid encrypted sandbox token.")
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    derivedKey(secret, "token-replay"),
    Buffer.from(nonceText, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(tagText, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

export function isCanonicalUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)
}

/** Stable because the public create body has exactly these three fields. */
export function sandboxRequestBodyHash(
  secret: string,
  input: { readonly name: string; readonly origin?: string; readonly claim_email?: string },
): string {
  const canonical = JSON.stringify({
    name: input.name,
    origin: input.origin ?? null,
    claim_email: input.claim_email === undefined ? null : normalizeClaimEmail(input.claim_email),
  })
  return keyedSandboxHash(secret, "request-body", canonical)
}

function expandIpv6(address: string): string[] | null {
  const zoneFree = address.split("%")[0] ?? address
  const halves = zoneFree.toLowerCase().split("::")
  if (halves.length > 2) return null
  const left = halves[0] === "" ? [] : (halves[0]?.split(":") ?? [])
  const right = halves.length === 1 || halves[1] === "" ? [] : (halves[1]?.split(":") ?? [])
  const missing = 8 - left.length - right.length
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null
  return [...left, ...Array.from({ length: missing }, () => "0"), ...right].map((part) =>
    part.padStart(4, "0"),
  )
}

/** IPv6 sources share a /64 fairness bucket; IPv4 stays per address. */
export function sourceAddressGroup(address: string): string {
  const normalized = address.trim().toLowerCase()
  if (isIP(normalized) !== 6) return normalized
  const parts = expandIpv6(normalized)
  return parts === null ? normalized : `${parts.slice(0, 4).join(":")}::/64`
}

export function sandboxSourceKey(secret: string, address: string): string {
  return keyedSandboxHash(secret, "abuse-source", sourceAddressGroup(address))
}

export function sandboxSubmissionIdempotencyHash(
  secret: string,
  sandboxId: string,
  key: string,
): string {
  return keyedSandboxHash(secret, "submission-idempotency", `${sandboxId}\0${key}`)
}

export function jsonDepth(value: unknown): number {
  if (value === null || typeof value !== "object") return 0
  const children = Array.isArray(value) ? value : Object.values(value)
  if (children.length === 0) return 1
  return 1 + Math.max(...children.map(jsonDepth))
}
