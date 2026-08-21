import { createClient, type components } from "@postbag/sdk"
import { toast } from "sonner"

export type ApiError = components["schemas"]["ErrorEnvelope"]["error"]

/** Every `/v1` list endpoint returns this shape. Named so hooks can annotate their
 * `queryFn` return type explicitly — TypeScript's inference through openapi-fetch's
 * response union does not reliably flow through a generic `unwrap<T>()` for nested
 * (array-in-object) response shapes, so we check against this instead of inferring it. */
export type Paginated<T> = { readonly data: readonly T[]; readonly next_cursor: string | null }

/** The dashboard is just another client of `/v1` (Principle 5) — same-origin cookie session,
 * whether that's the Vite dev proxy or the production SPA served from `apps/server/public`. */
export const api = createClient({ baseUrl: window.location.origin, credentials: "include" })

export class PostbagApiError extends Error {
  readonly code: string
  readonly hint?: string | undefined
  readonly docs?: string | undefined
  readonly details?: unknown

  constructor(error: ApiError) {
    super(error.message)
    this.name = "PostbagApiError"
    this.code = error.code
    this.hint = error.hint
    this.docs = error.docs
    this.details = error.details
  }
}

/** Unwrap an openapi-fetch result, throwing a `PostbagApiError` carrying the server's
 * `{ code, message, hint, docs }` envelope on failure (Golden rule 8 — agent-native errors). */
export function unwrap<T>(result: { readonly data?: T; readonly error?: unknown }): T {
  if (result.error !== undefined) {
    const envelope = result.error as { readonly error?: ApiError }
    if (envelope.error !== undefined) throw new PostbagApiError(envelope.error)
    throw new Error("Request failed.")
  }
  if (result.data === undefined) throw new Error("Request returned no data.")
  return result.data
}

/** Surface an API failure the way the API itself reports it (Golden rule 8): the server's
 * `message` as the headline and its `hint` — what to do next — as the description. Anything
 * that isn't a Postbag envelope (network, parsing) gets the caller's plain-language fallback.
 * Returns the error so callers can still branch on `code` afterwards. */
export function toastApiError(error: unknown, fallback: string): unknown {
  if (error instanceof PostbagApiError) {
    toast.error(error.message, error.hint === undefined ? undefined : { description: error.hint, duration: 8000 })
  } else {
    toast.error(fallback)
  }
  return error
}
