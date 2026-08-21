import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { newId, PostbagError } from "@postbag/core"
import { and, asc, eq } from "drizzle-orm"
import { events, member, session, user, type Database } from "@postbag/db"

import { countOwners, requireRole } from "../../lib/orgs.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { errorResponses, MemberSchema, UpdateMemberRoleInputSchema } from "../../schemas.js"

// Job L §2 — members, org-scoped. A session actor's authority comes from their Membership
// role; a `manage`-scoped API key is admin-equivalent (see lib/orgs.js `requireRole`) except
// for the owner-only role-change route, which stays a signed-in human decision.

const memberParams = z.object({ memberId: z.string().describe("The Membership id (not the user id).") })

const listMembersRoute = createRoute({
  method: "get",
  path: "/v1/members",
  operationId: "members_list",
  tags: ["discovery"],
  summary: "List the organization's members",
  responses: { 200: { description: "ok", content: { "application/json": { schema: z.array(MemberSchema) } } } },
})

const updateMemberRoleRoute = createRoute({
  method: "patch",
  path: "/v1/members/{memberId}",
  operationId: "members_update_role",
  tags: ["discovery"],
  summary: "Change a member's role (owner only)",
  description:
    "Owner only — an admin cannot promote or demote anyone, including themselves. Cannot demote the " +
    "organization's last owner (409 last_owner); promote someone else first.",
  request: {
    params: memberParams,
    body: { content: { "application/json": { schema: UpdateMemberRoleInputSchema } } },
  },
  responses: { 200: { description: "ok", content: { "application/json": { schema: MemberSchema } } }, ...errorResponses },
})

const removeMemberRoute = createRoute({
  method: "delete",
  path: "/v1/members/{memberId}",
  operationId: "members_remove",
  tags: ["discovery"],
  summary: "Remove a member, or leave the organization",
  description:
    "Owner or admin may remove any other member. A signed-in member may always remove themselves " +
    "(leave) regardless of role. Either way, the organization's last owner cannot be removed (409 last_owner).",
  request: { params: memberParams },
  responses: { 204: { description: "removed" }, ...errorResponses },
})

function serializeMemberRow(row: {
  readonly id: string
  readonly role: string
  readonly createdAt: Date
  readonly userId: string
  readonly userName: string
  readonly userEmail: string
}): z.infer<typeof MemberSchema> {
  return {
    id: row.id,
    user: { id: row.userId, name: row.userName, email: row.userEmail },
    role: row.role === "owner" || row.role === "admin" ? row.role : "member",
    joined_at: row.createdAt.toISOString(),
  }
}

export function registerMemberRoutes(app: OpenAPIHono<AppEnv>, db: Database): void {
  app.openapi(listMembersRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const rows = await db
      .select({
        id: member.id,
        role: member.role,
        createdAt: member.createdAt,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, scope.organizationId))
      .orderBy(asc(member.createdAt))
    return c.json(rows.map(serializeMemberRow))
  })

  app.openapi(updateMemberRoleRoute, async (c) => {
    const scope = c.var.scope
    await requireRole(db, scope, ["owner"])
    const { memberId } = c.req.valid("param")
    const { role: newRole } = c.req.valid("json")

    const [target] = await db
      .select()
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, scope.organizationId)))
      .limit(1)
    if (target === undefined) throw new PostbagError("not_found", "No member with that id.")

    if (target.role === "owner" && newRole !== "owner") {
      const owners = await countOwners(db, scope.organizationId)
      if (owners <= 1) {
        throw new PostbagError("last_owner", "An organization needs at least one owner.")
      }
    }

    const [updated] = await db.update(member).set({ role: newRole }).where(eq(member.id, memberId)).returning()
    if (updated === undefined) throw new PostbagError("not_found", "No member with that id.")
    const [u] = await db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(eq(user.id, updated.userId)).limit(1)
    if (u === undefined) throw new Error("Member row references a missing user.")

    await db.insert(events).values({
      id: newId("ev"),
      organizationId: scope.organizationId,
      type: "member.role_changed",
      subject: { member_id: memberId, user_id: updated.userId },
      data: { from: target.role, to: newRole },
    })

    return c.json(serializeMemberRow({ ...updated, userId: u.id, userName: u.name, userEmail: u.email }))
  })

  app.openapi(removeMemberRoute, async (c) => {
    const scope = c.var.scope
    const { memberId } = c.req.valid("param")

    const [target] = await db
      .select()
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, scope.organizationId)))
      .limit(1)
    if (target === undefined) throw new PostbagError("not_found", "No member with that id.")

    const isSelf = scope.actor.type === "session" && scope.actor.userId === target.userId
    if (!isSelf) {
      await requireRole(db, scope, ["owner", "admin"])
    }

    if (target.role === "owner") {
      const owners = await countOwners(db, scope.organizationId)
      if (owners <= 1) {
        throw new PostbagError(
          "last_owner",
          isSelf ? "You are the only owner — promote someone else first." : "An organization needs at least one owner.",
        )
      }
    }

    await db.delete(member).where(eq(member.id, memberId))
    if (isSelf) {
      await db
        .update(session)
        .set({ activeOrganizationId: null })
        .where(and(eq(session.userId, target.userId), eq(session.activeOrganizationId, scope.organizationId)))
    }

    await db.insert(events).values({
      id: newId("ev"),
      organizationId: scope.organizationId,
      type: "member.removed",
      subject: { member_id: memberId, user_id: target.userId },
      data: { role: target.role, self: isSelf },
    })

    return c.body(null, 204)
  })
}
