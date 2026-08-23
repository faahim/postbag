import { expandScopes } from "@postbag/auth"
import type { MiddlewareHandler } from "hono"
import type { Database } from "@postbag/db"

import type { Auth } from "../authSetup.js"
import { unauthorized } from "../lib/errors.js"
import { resolveAnyOrganizationId, resolveOwnedOrganizationId } from "../lib/orgs.js"
import type { RequestScope, Variables } from "../lib/scope.js"

const ALL_SCOPES = ["manage", "read", "submit"] as const

// better-auth's generated `auth.api.verifyApiKey` overload resolves to `Promise<Response>`
// here (its `StrictEndpoint` overload set does not narrow cleanly once combined with the
// organization + apiKey plugins). The runtime always returns the parsed object unless
// `asResponse: true` is passed, so this is a typing-only workaround.
type VerifyApiKeyResult = {
  readonly valid: boolean
  readonly key: {
    readonly id: string
    readonly referenceId: string
    readonly metadata: unknown
  } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function scopesFromMetadata(metadata: unknown): readonly ("manage" | "read" | "submit")[] {
  if (!isRecord(metadata)) return []
  const scopes = metadata["scopes"]
  if (!Array.isArray(scopes)) return []
  return scopes.filter(
    (value): value is "manage" | "read" | "submit" =>
      value === "manage" || value === "read" || value === "submit",
  )
}

function userIdFromMetadata(metadata: unknown): string | undefined {
  if (!isRecord(metadata)) return undefined
  const userId = metadata["created_by_user_id"]
  return typeof userId === "string" && userId.length > 0 ? userId : undefined
}

/** Job L §1: the `activeOrganizationId`-less fallback is the org the user *owns* (oldest
 * owner membership) — never the most recently joined membership. Being invited into
 * someone else's org must not change a user's default dashboard. Every user owns at least
 * their personal org from signup, so `resolveAnyOrganizationId` is only reached for
 * legacy/pathological data with no owned org at all. */
async function resolveFallbackOrganization(db: Database, userId: string): Promise<string | null> {
  const owned = await resolveOwnedOrganizationId(db, userId)
  if (owned !== null) return owned
  return resolveAnyOrganizationId(db, userId)
}

export function requireOrg(auth: Auth, db: Database): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, next) => {
    const authorization = c.req.header("authorization")
    if (authorization?.startsWith("Bearer ") === true) {
      const key = authorization.slice("Bearer ".length).trim()
      const result = (await auth.api.verifyApiKey({
        body: { configId: "postbag", key },
      })) as unknown as VerifyApiKeyResult
      if (!result.valid || result.key === null) {
        throw unauthorized("The API key is invalid, disabled, or expired.")
      }
      const userId = userIdFromMetadata(result.key.metadata)
      const scope: RequestScope = {
        organizationId: result.key.referenceId,
        actor: {
          type: "api_key",
          apiKeyId: result.key.id,
          ...(userId === undefined ? {} : { userId }),
        },
        // Effective scopes: manage ⊇ read ⊇ submit (@postbag/auth). Expanding here means
        // every downstream `assertScope` check and the /v1/me echo see the same set.
        scopes: expandScopes(scopesFromMetadata(result.key.metadata)),
      }
      c.set("scope", scope)
      await next()
      return
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers, asResponse: false })
    if (session === null) {
      throw unauthorized("Sign in, or provide Authorization: Bearer pb_live_….")
    }
    const activeOrganizationId = session.session.activeOrganizationId
    const organizationId =
      activeOrganizationId ?? (await resolveFallbackOrganization(db, session.user.id))
    if (organizationId === null) {
      throw unauthorized("This account does not belong to an organization yet.")
    }
    const scope: RequestScope = {
      organizationId,
      actor: { type: "session", userId: session.user.id },
      scopes: ALL_SCOPES,
    }
    c.set("scope", scope)
    await next()
  }
}
