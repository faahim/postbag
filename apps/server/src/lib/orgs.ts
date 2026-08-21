import { and, asc, count, desc, eq } from "drizzle-orm"
import { member, type Database } from "@postbag/db"

import { PostbagError } from "@postbag/core"

import type { RequestScope } from "./scope.js"
import { assertScope } from "./scope.js"

/** Membership role — `docs/DOMAIN-MODEL.md`: owner > admin > member. Fixed vocabulary,
 * enforced everywhere a Membership's role is read or written (job L). */
export const MEMBER_ROLES = ["owner", "admin", "member"] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

export function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value)
}

/** The organization the user *owns*, oldest owner membership first. Every user owns at
 * least their personal organization from signup (`provisionPersonalOrganization`), so
 * this only comes back `null` for pathological/legacy data. Job L §1: this — not "most
 * recently joined" — is the `requireOrg` fallback, so a new invitation never changes a
 * user's default dashboard. */
export async function resolveOwnedOrganizationId(db: Database, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, "owner" satisfies MemberRole)))
    .orderBy(asc(member.createdAt))
    .limit(1)
  return row?.organizationId ?? null
}

/** Last-resort fallback (pre-job-L behaviour): the most recently joined membership of any
 * role. Only reached if a user somehow owns no organization at all. */
export async function resolveAnyOrganizationId(db: Database, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(desc(member.createdAt))
    .limit(1)
  return row?.organizationId ?? null
}

/** The session user's role in a specific organization, or `null` if they are not a member. */
export async function lookupMemberRole(
  db: Database,
  organizationId: string,
  userId: string,
): Promise<MemberRole | null> {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1)
  if (row === undefined) return null
  return isMemberRole(row.role) ? row.role : "member"
}

export async function countOwners(db: Database, organizationId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner" satisfies MemberRole)))
  return row?.value ?? 0
}

/**
 * The role gate for member/invitation/org-settings management (job L §2). A session
 * actor's role comes from their Membership row. An API key has no Membership of its own
 * (`apikey` is org-scoped, not user-scoped — see schema/auth.ts) but a `manage`-scoped key
 * is already the highest privilege a key can hold and can only have been minted by an
 * owner or admin (job L also gates `POST /v1/api-keys` to owner/admin) — so it is treated
 * as admin-equivalent: sufficient for an "admin" gate, never for an "owner"-only one
 * (role changes, deleting the org, changing owners stay a human-with-a-session decision).
 * Returns the resolved role so callers needing it (e.g. "is this the caller themselves")
 * don't look it up twice.
 */
export async function requireRole(
  db: Database,
  scope: RequestScope,
  allowed: readonly MemberRole[],
): Promise<MemberRole> {
  if (scope.actor.type === "api_key") {
    assertScope(scope, "manage")
    if (allowed.includes("admin")) return "admin"
    throw new PostbagError(
      "forbidden",
      "This operation is owner-only and requires a signed-in session — API keys are treated as admin-equivalent at most.",
    )
  }
  const role = await lookupMemberRole(db, scope.organizationId, scope.actor.userId)
  if (role === null || !allowed.includes(role)) {
    throw new PostbagError("forbidden", `This operation requires the ${allowed.join(" or ")} role.`, {
      required_role: allowed,
      actual_role: role,
    })
  }
  return role
}
