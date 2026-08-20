import { ERROR_DEFINITIONS, PostbagError, type ErrorCode } from "@postbag/core"

export type ErrorEnvelopeBody = {
  readonly error: {
    readonly code: string
    readonly message: string
    readonly hint?: string
    readonly docs?: string
    readonly details?: Readonly<Record<string, unknown>>
  }
}

const DOCS_BASE = "https://postbag.withfaahim.com/docs/errors"

export function envelope(
  code: string,
  message: string,
  options?: {
    readonly hint?: string | undefined
    readonly details?: Readonly<Record<string, unknown>> | undefined
  },
): ErrorEnvelopeBody {
  return {
    error: {
      code,
      message,
      ...(options?.hint === undefined ? {} : { hint: options.hint }),
      docs: `${DOCS_BASE}/${code}`,
      ...(options?.details === undefined ? {} : { details: options.details }),
    },
  }
}

export function fromPostbagError(error: PostbagError): ErrorEnvelopeBody {
  return envelope(error.code, error.message, { hint: error.hint, details: error.details })
}

export function statusFor(code: ErrorCode): number {
  return ERROR_DEFINITIONS[code].status
}

export function notFound(message = "Not found."): PostbagError {
  return new PostbagError("not_found", message)
}

export function unauthorized(message = "Authentication is required."): PostbagError {
  return new PostbagError("unauthorized", message)
}
