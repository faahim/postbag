import { PostbagError } from "@postbag/core"
import { and, eq } from "drizzle-orm"
import { apikey, member, user, type Database } from "@postbag/db"

import type { RequestScope } from "./scope.js"

export type CallerIdentity = { readonly userId: string; readonly email: string }

/**
 * Job K — resolves the user that identifies the caller for the `PLATFORM_ADMIN_EMAILS`
 * check, per the route description on POST /v1/admin/plan-grants: a session actor's own
 * user, or — for an API key — the *owner* member of the key's organization (the key's
 * org → owner member → user). This deliberately does not grant every member of an
 * admin's org platform-admin rights: only the owner's email counts, and only when it is
 * literally in the env list.
 *
 * Returns `null` if no identifying user can be resolved (should not happen for a scope
 * requireOrg already produced, but callers treat `null` the same as "not an admin").
 */
export async function resolveCallerIdentity(db: Database, scope: RequestScope): Promise<CallerIdentity | null> {
  if (scope.actor.type === "session") {
    const [row] = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, scope.actor.userId))
      .limit(1)
    return row === undefined ? null : { userId: row.id, email: row.email }
  }

  const [keyRow] = await db
    .select({ organizationId: apikey.referenceId })
    .from(apikey)
    .where(eq(apikey.id, scope.actor.apiKeyId))
    .limit(1)
  if (keyRow === undefined) return null

  const [ownerRow] = await db
    .select({ id: user.id, email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, keyRow.organizationId), eq(member.role, "owner")))
    .orderBy(member.createdAt)
    .limit(1)
  return ownerRow === undefined ? null : { userId: ownerRow.id, email: ownerRow.email }
}

/** Whether an email is in the comma-separated `PLATFORM_ADMIN_EMAILS` allowlist. Case-insensitive; matches env.ts's own normalization. */
export function isPlatformAdminEmail(email: string | null, platformAdminEmails: readonly string[]): boolean {
  if (email === null || platformAdminEmails.length === 0) return false
  return platformAdminEmails.includes(email.trim().toLowerCase())
}

/**
 * Resolves the caller and requires them to be a platform admin, or throws `404
 * not_found` — never `403` — so a self-hoster with an empty `PLATFORM_ADMIN_EMAILS`
 * never learns these endpoints exist.
 */
export async function requirePlatformAdmin(
  db: Database,
  scope: RequestScope,
  platformAdminEmails: readonly string[],
): Promise<CallerIdentity> {
  const identity = await resolveCallerIdentity(db, scope)
  if (!isPlatformAdminEmail(identity?.email ?? null, platformAdminEmails) || identity === null) {
    throw new PostbagError("not_found", "Not found.")
  }
  return identity
}
