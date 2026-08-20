import { desc, eq } from "drizzle-orm"
import { member, type Database } from "@postbag/db"
import type { MiddlewareHandler } from "hono"

import type { Auth } from "../authSetup.js"
import { unauthorized } from "../lib/errors.js"
import type { RequestScope, Variables } from "../lib/scope.js"

const ALL_SCOPES = ["manage", "read", "submit"] as const

// better-auth's generated `auth.api.verifyApiKey` overload resolves to `Promise<Response>`
// here (its `StrictEndpoint` overload set does not narrow cleanly once combined with the
// organization + apiKey plugins). The runtime always returns the parsed object unless
// `asResponse: true` is passed, so this is a typing-only workaround.
type VerifyApiKeyResult = {
  readonly valid: boolean
  readonly key: { readonly id: string; readonly referenceId: string; readonly metadata: unknown } | null
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

async function resolveFirstOrganization(db: Database, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(desc(member.createdAt))
    .limit(1)
  return row?.organizationId ?? null
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
      const scope: RequestScope = {
        organizationId: result.key.referenceId,
        actor: { type: "api_key", apiKeyId: result.key.id },
        scopes: scopesFromMetadata(result.key.metadata),
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
      activeOrganizationId ?? (await resolveFirstOrganization(db, session.user.id))
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
