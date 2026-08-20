export const DISPOSABLE_EMAIL_DOMAINS = [
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "temp-mail.org",
  "yopmail.com",
] as const

export type SpamInput = {
  readonly data: Readonly<Record<string, unknown>>
  readonly control: Readonly<Record<string, unknown>>
  readonly meta: Readonly<Record<string, unknown>>
  readonly honeypotField: string
}
export type SpamScore = { readonly score: number; readonly reasons: readonly string[] }

function stringsIn(value: unknown): readonly string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(stringsIn)
  return []
}

function isFilled(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null
}

function roundScore(value: number): number {
  return Math.round(Math.min(1, value) * 100) / 100
}

export function scoreSpam(input: SpamInput): SpamScore {
  const honeypot = input.control[input.honeypotField] ?? input.data[input.honeypotField]
  if (isFilled(honeypot)) return { score: 1, reasons: ["honeypot_filled"] }

  const strings = stringsIn(input.data)
  const text = strings.join(" ")
  const reasons: string[] = []
  let score = 0
  const linkCount = text.match(/https?:\/\/\S+/gu)?.length ?? 0
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/u).length
  if (linkCount >= 2 && linkCount / Math.max(1, wordCount) >= 0.15) {
    score += 0.25
    reasons.push("high_link_density")
  }
  if (text.length > 10_000) {
    score += 0.2
    reasons.push("excessive_length")
  }
  const emailDomains = strings.flatMap((value) => {
    const match = /@([^\s>]+)$/u.exec(value.toLowerCase())
    return match?.[1] === undefined ? [] : [match[1]]
  })
  if (
    emailDomains.some((domain) =>
      DISPOSABLE_EMAIL_DOMAINS.some((candidate) => candidate === domain),
    )
  ) {
    score += 0.35
    reasons.push("disposable_email")
  }
  const letters = Array.from(text).filter((character) => /[a-z]/iu.test(character))
  const uppercase = letters.filter((character) => character === character.toUpperCase()).length
  if (letters.length >= 20 && uppercase / letters.length >= 0.7) {
    score += 0.2
    reasons.push("high_all_caps_ratio")
  }
  if (/(.)\1{7,}/iu.test(text)) {
    score += 0.2
    reasons.push("repeated_characters")
  }
  return { score: roundScore(score), reasons }
}
