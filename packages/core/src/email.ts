/**
 * Mailbox identity — "do these two addresses reach the same inbox?"
 *
 * Used wherever an email address stands in for a person (accepting an invitation sent to
 * one address while signed in with another). Deliberately narrow: we only fold the
 * differences that providers *guarantee* route to the same mailbox.
 *
 * - Case and surrounding whitespace never matter.
 * - `+tag` sub-addressing is stripped everywhere: providers that support it route the tag
 *   to the base mailbox, and providers that don't would not have delivered the invitation
 *   email in the first place.
 * - Gmail (and its googlemail.com alias) ignores dots in the local part, so
 *   `afiur.fahim@gmail.com`, `afiurfahim@gmail.com` and `a.f.i.u.r.fahim@googlemail.com` are
 *   one inbox. No other provider gets dot-folding — on most of them the dots are significant.
 */

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"])

/** Canonical form of an address for *identity comparison* (not for sending — never rewrite
 * what the user typed when delivering mail). Returns the lowercased, trimmed input when it
 * doesn't look like an address. */
export function normalizeMailbox(email: string): string {
  const lowered = email.trim().toLowerCase()
  const at = lowered.lastIndexOf("@")
  if (at <= 0 || at === lowered.length - 1) return lowered
  let local = lowered.slice(0, at)
  let domain = lowered.slice(at + 1)
  const plus = local.indexOf("+")
  if (plus > 0) local = local.slice(0, plus)
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replaceAll(".", "")
    domain = "gmail.com"
  }
  return `${local}@${domain}`
}

/** True when both addresses reach the same inbox (see `normalizeMailbox`). */
export function sameMailbox(a: string, b: string): boolean {
  return normalizeMailbox(a) === normalizeMailbox(b)
}
