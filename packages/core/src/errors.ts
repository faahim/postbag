export const ERROR_DEFINITIONS = {
  not_found: { status: 404, hint: "Check the id and organization scope." },
  forbidden: { status: 403, hint: "Use credentials with permission for this operation." },
  unauthorized: {
    status: 401,
    hint: "Provide a session cookie or an Authorization: Bearer pb_live_… key.",
  },
  validation_failed: { status: 422, hint: "Correct the fields described in details and retry." },
  mapping_incomplete: { status: 422, hint: "Map every required stream field before attaching." },
  stream_schema_missing: {
    status: 422,
    hint: "Attach a form that has a published schema or at least one submission — Postbag derives the stream's first schema from it — or publish one with POST /v1/streams/{id}/schema.",
  },
  schema_violation: {
    status: 422,
    hint: "Publish a compatible schema or correct the submitted fields.",
  },
  payload_too_large: {
    status: 413,
    hint: "Reduce the payload size, field count, or nesting depth.",
  },
  unsupported_media_type: {
    status: 415,
    hint: "Send JSON, URL-encoded data, or multipart form data supported by this endpoint.",
  },
  attachment_too_large: {
    status: 413,
    hint: "Use a smaller file or increase the organization's attachment limit.",
  },
  attachment_limit_reached: {
    status: 413,
    hint: "Remove attachments or increase the organization's per-Submission limit.",
  },
  attachment_storage_limit_reached: {
    status: 402,
    hint: "Delete old Submissions with attachments, or upgrade the organization's plan.",
  },
  attachment_storage_unavailable: {
    status: 503,
    hint: "Configure an S3-compatible private bucket, then retry the Submission.",
  },
  rate_limited: { status: 429, hint: "Retry after the indicated delay." },
  origin_rejected: { status: 403, hint: "Add the site origin to the Form allowed origins." },
  idempotency_conflict: { status: 409, hint: "Reuse the key only for the identical operation." },
  anonymous_quickstart_disabled: {
    status: 503,
    hint: "Use POST /v1/auth/request-code, then the authenticated POST /v1/quickstart path.",
  },
  sandbox_unauthorized: {
    status: 401,
    hint: "Provide the sandbox token using the documented Sandbox authorization scheme.",
  },
  sandbox_expired: {
    status: 410,
    hint: "Create a new sandbox. Anonymous Forms expire after 24 hours.",
  },
  sandbox_limit_reached: {
    status: 409,
    hint: "Claim this Form or create a new sandbox. A sandbox accepts at most five Submissions.",
  },
  sandbox_claimed: {
    status: 410,
    hint: "This sandbox token has been consumed. Use the claimed Form through the authenticated API.",
  },
  sandbox_claim_email_mismatch: {
    status: 403,
    hint: "Sign in with the verified email address bound when this sandbox was created.",
  },
  sandbox_capacity_reached: {
    status: 503,
    hint: "Use the authenticated quickstart path or retry after other anonymous sandboxes expire.",
  },
  conflict: { status: 409, hint: "The resource already exists, or is still referenced elsewhere." },
  plan_limit_reached: { status: 402, hint: "Change plan limits or remove an unused resource." },
  billing_disabled: {
    status: 501,
    hint: "Set the Polar billing environment variables, or use this instance as self-hosted.",
  },
  billing_product_unavailable: {
    status: 422,
    hint: "Choose a plan and billing interval configured by this Postbag instance.",
  },
  // Job K — plan grants (complimentary access) and the checkout guard that will sit in
  // front of Polar billing (ADR-007) once it exists.
  grant_not_found: { status: 404, hint: "Check the code and try again." },
  grant_expired: { status: 410, hint: "Ask whoever sent the code for a new one." },
  grant_revoked: { status: 410, hint: "This code was revoked and can no longer be redeemed." },
  grant_exhausted: {
    status: 410,
    hint: "This code has already been redeemed the maximum number of times.",
  },
  plan_is_billing: {
    status: 409,
    hint: "This organization already pays for its plan — cancel the subscription first if you want to redeem a code instead.",
  },
  plan_not_upgrade: {
    status: 409,
    hint: "This code's plan is not higher than the organization's current plan.",
  },
  plan_is_complimentary: {
    status: 409,
    hint: "This organization has complimentary access; billing does not apply while it is active.",
  },
  expressions_not_enabled: {
    status: 422,
    hint: "Use from, const, or default until expressions ship.",
  },
  // Job L — members, invitations, roles.
  invitation_expired: { status: 410, hint: "Ask an owner or admin to invite you again." },
  invitation_already_used: {
    status: 409,
    hint: "This invitation was already accepted or revoked.",
  },
  invitation_email_mismatch: {
    status: 403,
    hint: "Sign out and sign in (or up) with the invited email address, then accept again.",
  },
  last_owner: {
    status: 409,
    hint: "Promote another member to owner first, or transfer ownership before removing yourself.",
  },
  internal_error: { status: 500, hint: "Retry; contact support if this persists." },
} as const

export type ErrorCode = keyof typeof ERROR_DEFINITIONS

export class PostbagError extends Error {
  readonly code: ErrorCode
  readonly hint: string
  readonly docs: string
  readonly status: number
  readonly details?: Readonly<Record<string, unknown>>

  constructor(
    code: ErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = new.target.name
    const definition = ERROR_DEFINITIONS[code]
    this.code = code
    this.hint = definition.hint
    this.docs = `https://postbag.dev/docs/errors/${code}`
    this.status = definition.status
    if (details !== undefined) this.details = details
  }
}

export class PayloadTooLarge extends PostbagError {
  constructor(message = "The submission payload exceeds a safe processing boundary.") {
    super("payload_too_large", message)
  }
}

export class ExpressionsNotEnabled extends PostbagError {
  constructor() {
    super("expressions_not_enabled", "Mapping expressions are not enabled in Phase 1.")
  }
}

export class TemplateSyntaxError extends PostbagError {
  constructor(message: string) {
    super("validation_failed", message)
  }
}

export class UnsupportedDigestCron extends PostbagError {
  constructor(cron: string) {
    super(
      "validation_failed",
      `Digest cron '${cron}' is outside the supported daily/weekly subset.`,
    )
  }
}
