export const ERROR_DEFINITIONS = {
  not_found: { status: 404, hint: "Check the id and organization scope." },
  forbidden: { status: 403, hint: "Use credentials with permission for this operation." },
  validation_failed: { status: 422, hint: "Correct the fields described in details and retry." },
  mapping_incomplete: { status: 422, hint: "Map every required stream field before attaching." },
  schema_violation: {
    status: 422,
    hint: "Publish a compatible schema or correct the submitted fields.",
  },
  payload_too_large: {
    status: 413,
    hint: "Reduce the payload size, field count, or nesting depth.",
  },
  rate_limited: { status: 429, hint: "Retry after the indicated delay." },
  origin_rejected: { status: 403, hint: "Add the site origin to the Form allowed origins." },
  idempotency_conflict: { status: 409, hint: "Reuse the key only for the identical operation." },
  plan_limit_reached: { status: 402, hint: "Change plan limits or remove an unused resource." },
  expressions_not_enabled: {
    status: 422,
    hint: "Use from, const, or default until expressions ship.",
  },
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
