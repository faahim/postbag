export type QuarantineReason =
  "schema_violation" | "rate_limited" | "origin_rejected" | "turnstile_failed" | "over_quota"

export type QuarantineReasonDetail = {
  readonly label: string
  readonly description: string
}

const REASONS: Readonly<Record<QuarantineReason, QuarantineReasonDetail>> = {
  schema_violation: {
    label: "Schema mismatch",
    description: "The submitted fields did not match this Form's current schema.",
  },
  rate_limited: {
    label: "Rate limit reached",
    description: "This Form received too many submissions from the same IP in a short period.",
  },
  origin_rejected: {
    label: "Origin not allowed",
    description: "The posting site's hostname or port did not match this Form's allowed origins.",
  },
  turnstile_failed: {
    label: "Turnstile failed",
    description: "Turnstile verification was missing, invalid, or could not be verified.",
  },
  over_quota: {
    label: "Monthly limit reached",
    description:
      "This workspace reached its monthly allowance. Upgrade or wait for capacity before releasing it.",
  },
}

function isQuarantineReason(reason: string): reason is QuarantineReason {
  return Object.hasOwn(REASONS, reason)
}

export function quarantineReasonDetail(reason: string | null): QuarantineReasonDetail {
  if (reason !== null && isQuarantineReason(reason)) return REASONS[reason]
  return {
    label: reason === null ? "Reason unavailable" : reason.replaceAll("_", " "),
    description:
      "Postbag held this submission instead of delivering it. Review the Form settings before releasing it.",
  }
}
