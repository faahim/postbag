import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { newId, PostbagError, sameMailbox } from "@postbag/core"
import { and, desc, eq } from "drizzle-orm"
import { events, invitation, member, organization, user, type Database } from "@postbag/db"

import type { Auth } from "../../authSetup.js"
import type { Env } from "../../env.js"
import { envelope } from "../../lib/errors.js"
import { createInvitationEmailSender, type InvitationEmailSender } from "../../lib/invitationEmail.js"
import { requireRole } from "../../lib/orgs.js"
import { setActiveOrganizationWithCookies } from "./organizations.js"
import { assertScope, assertSessionActor, type AppEnv } from "../../lib/scope.js"
import {
  errorResponses,
  ErrorEnvelopeSchema,
  InvitationCreateInputSchema,
  InvitationSchema,
  AcceptInvitationResponseSchema,
  PublicInvitationSchema,
} from "../../schemas.js"

// Job L §2 — invitations. Created and revoked directly against the `invitation` table
// (not through Better Auth's organization plugin) because its `createInvitation` /
// `cancelInvitation` / `listInvitations` / `getInvitation` endpoints all require a signed-in
// session (`orgSessionMiddleware`) — a manage-scoped API key has no session, and
// agent-native parity (CLAUDE.md golden rule 8, `docs/AGENT-NATIVE.md`) means
// `postbag invitations create` must work the same way `postbag api-keys create` does today.
// `POST /v1/invitations/{id}/accept` is the one exception that stays session-only (someone
// has to be signed in as the invitee to accept), and it *does* delegate to Better Auth's
// `setActiveOrganization` afterward so the session cookie cache refreshes immediately.

const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

const invitationIdParam = z.object({ id: z.string() })

const listInvitationsRoute = createRoute({
  method: "get",
  path: "/v1/invitations",
  operationId: "invitations_list",
  tags: ["discovery"],
  summary: "List pending invitations",
  responses: { 200: { description: "ok", content: { "application/json": { schema: z.array(InvitationSchema) } } } },
})

const createInvitationRoute = createRoute({
  method: "post",
  path: "/v1/invitations",
  operationId: "invitations_create",
  tags: ["discovery"],
  summary: "Invite someone to the organization",
  description:
    "Owner or admin. Sends an email via Resend when the server has RESEND_API_KEY configured; otherwise " +
    "the invitation is still created and its accept link can be shared manually. Re-inviting an address " +
    "with a pending invitation resends it (extends the 7-day expiry) instead of creating a duplicate.",
  request: { body: { content: { "application/json": { schema: InvitationCreateInputSchema } } } },
  responses: {
    201: { description: "created", content: { "application/json": { schema: InvitationSchema } } },
    502: { description: "The invitation was created, but the email could not be sent", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
    ...errorResponses,
  },
})

const revokeInvitationRoute = createRoute({
  method: "delete",
  path: "/v1/invitations/{id}",
  operationId: "invitations_revoke",
  tags: ["discovery"],
  summary: "Revoke a pending invitation",
  request: { params: invitationIdParam },
  responses: { 204: { description: "revoked" }, ...errorResponses },
})

const getInvitationRoute = createRoute({
  method: "get",
  path: "/v1/invitations/{id}",
  operationId: "invitations_get",
  tags: ["discovery"],
  summary: "Look up a pending invitation (public)",
  description:
    "Public — no credentials required, so the accept page can render the org name and inviter before " +
    "the visitor signs in. The invited email is masked (email_hint).",
  security: [],
  request: { params: invitationIdParam },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: PublicInvitationSchema } } },
    ...errorResponses,
  },
})

const acceptInvitationRoute = createRoute({
  method: "post",
  path: "/v1/invitations/{id}/accept",
  operationId: "invitations_accept",
  tags: ["discovery"],
  summary: "Accept an invitation (session only)",
  description:
    "Session only. The signed-in user's email must match the invitation's invited email exactly " +
    "(403 invitation_email_mismatch otherwise). On success the organization becomes this session's " +
    "active organization.",
  request: { params: invitationIdParam },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: AcceptInvitationResponseSchema } } },
    ...errorResponses,
  },
})

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (local === undefined || domain === undefined) return email
  const visible = local.slice(0, 1)
  return `${visible}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`
}

type InvitationRow = typeof invitation.$inferSelect

function serializeInvitation(
  row: InvitationRow,
  invitedBy: { readonly id: string; readonly name: string; readonly email: string } | null,
): z.infer<typeof InvitationSchema> {
  return {
    id: row.id,
    email: row.email,
    role: row.role === "owner" || row.role === "admin" ? row.role : "member",
    expires_at: row.expiresAt.toISOString(),
    invited_by: invitedBy,
    created_at: row.createdAt.toISOString(),
  }
}

/** Loads a still-actionable invitation by id, or throws the right agent-native error:
 * `not_found` if it never existed, `invitation_already_used` once accepted/canceled,
 * `invitation_expired` past its `expiresAt` (status stays "pending" until acted on, so
 * this is a separate, time-based check). Shared by the public lookup and accept routes. */
async function loadPendingInvitation(db: Database, id: string): Promise<InvitationRow> {
  const [row] = await db.select().from(invitation).where(eq(invitation.id, id)).limit(1)
  if (row === undefined) throw new PostbagError("not_found", "No invitation with that id.")
  if (row.status !== "pending") {
    throw new PostbagError("invitation_already_used", "This invitation was already accepted or revoked.")
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw new PostbagError("invitation_expired", "This invitation expired.")
  }
  return row
}

/**
 * Registered before `app.use("/v1/*", requireOrg(...))` in app.ts (like
 * `registerAuthProviderRoutes`/`registerAuthCodeRoutes` above it) — in Hono, middleware
 * only wraps routes registered *after* it, so this is the only way `GET
 * /v1/invitations/{id}` stays reachable with no session and no API key, for the
 * accept-invitation page to render before sign-in.
 */
export function registerPublicInvitationRoutes(app: OpenAPIHono<AppEnv>, db: Database): void {
  app.openapi(getInvitationRoute, async (c) => {
    const { id } = c.req.valid("param")
    const row = await loadPendingInvitation(db, id)
    const [org] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, row.organizationId)).limit(1)
    if (org === undefined) throw new PostbagError("not_found", "No invitation with that id.")
    const inviterName =
      row.inviterId === null
        ? null
        : ((await db.select({ name: user.name }).from(user).where(eq(user.id, row.inviterId)).limit(1))[0]?.name ?? null)

    const body: z.infer<typeof PublicInvitationSchema> = {
      organization: { name: org.name },
      invited_by_name: inviterName,
      role: row.role === "owner" || row.role === "admin" ? row.role : "member",
      expires_at: row.expiresAt.toISOString(),
      email_hint: maskEmail(row.email),
    }
    return c.json(body)
  })
}

export function registerInvitationRoutes(app: OpenAPIHono<AppEnv>, auth: Auth, db: Database, env: Env): void {
  const sendInvitationEmail: InvitationEmailSender | undefined = createInvitationEmailSender(
    env.RESEND_API_KEY === undefined ? undefined : { resendApiKey: env.RESEND_API_KEY, mailFrom: env.MAIL_FROM },
  )

  app.openapi(listInvitationsRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const rows = await db
      .select({ invitation, inviterId: user.id, inviterName: user.name, inviterEmail: user.email })
      .from(invitation)
      .leftJoin(user, eq(user.id, invitation.inviterId))
      .where(and(eq(invitation.organizationId, scope.organizationId), eq(invitation.status, "pending")))
      .orderBy(desc(invitation.createdAt))
    return c.json(
      rows.map((row) =>
        serializeInvitation(
          row.invitation,
          row.inviterId === null ? null : { id: row.inviterId, name: row.inviterName ?? "", email: row.inviterEmail ?? "" },
        ),
      ),
    )
  })

  app.openapi(createInvitationRoute, async (c) => {
    const scope = c.var.scope
    await requireRole(db, scope, ["owner", "admin"])
    const { email: rawEmail, role } = c.req.valid("json")
    const email = rawEmail.trim().toLowerCase()

    const [existingMember] = await db
      .select({ id: member.id })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(and(eq(member.organizationId, scope.organizationId), eq(user.email, email)))
      .limit(1)
    if (existingMember !== undefined) {
      throw new PostbagError("conflict", "That address already belongs to a member of this organization.")
    }

    const [org] = await db.select().from(organization).where(eq(organization.id, scope.organizationId)).limit(1)
    if (org === undefined) throw new Error("Organization not found for an authenticated scope.")

    let inviterId: string | null = null
    let inviterName = "Someone"
    let inviterEmail: string | null = null
    if (scope.actor.type === "session") {
      const [inviter] = await db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(eq(user.id, scope.actor.userId)).limit(1)
      if (inviter !== undefined) {
        inviterId = inviter.id
        inviterName = inviter.name
        inviterEmail = inviter.email
      }
    }

    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS)
    const [existingInvite] = await db
      .select()
      .from(invitation)
      .where(and(eq(invitation.organizationId, scope.organizationId), eq(invitation.email, email), eq(invitation.status, "pending")))
      .limit(1)

    let row: InvitationRow
    if (existingInvite !== undefined) {
      const [updated] = await db
        .update(invitation)
        .set({ role, expiresAt, inviterId })
        .where(eq(invitation.id, existingInvite.id))
        .returning()
      if (updated === undefined) throw new Error("Failed to resend invitation.")
      row = updated
    } else {
      const [created] = await db
        .insert(invitation)
        .values({ id: newId("iv"), organizationId: scope.organizationId, email, role, status: "pending", expiresAt, inviterId })
        .returning()
      if (created === undefined) throw new Error("Failed to create invitation.")
      row = created
      await db.insert(events).values({
        id: newId("ev"),
        organizationId: scope.organizationId,
        type: "member.invited",
        subject: { invitation_id: row.id },
        data: { email, role },
      })
    }

    if (sendInvitationEmail !== undefined) {
      try {
        await sendInvitationEmail({
          to: email,
          inviterName,
          organizationName: org.name,
          role,
          acceptUrl: `${env.APP_URL}/app/invitations/${row.id}`,
        })
      } catch (error) {
        return c.json(
          envelope("email_send_failed", "The invitation was created, but the email could not be sent.", {
            hint: "This is usually transient — resend by inviting the same address again, or share the accept link directly.",
            details: { invitation_id: row.id, reason: error instanceof Error ? error.message : String(error) },
          }),
          502,
        )
      }
    }

    return c.json(
      serializeInvitation(row, inviterId === null ? null : { id: inviterId, name: inviterName, email: inviterEmail ?? email }),
      201,
    )
  })

  app.openapi(revokeInvitationRoute, async (c) => {
    const scope = c.var.scope
    await requireRole(db, scope, ["owner", "admin"])
    const { id } = c.req.valid("param")
    const [row] = await db
      .select({ id: invitation.id })
      .from(invitation)
      .where(and(eq(invitation.id, id), eq(invitation.organizationId, scope.organizationId), eq(invitation.status, "pending")))
      .limit(1)
    if (row === undefined) throw new PostbagError("not_found", "No pending invitation with that id.")
    await db.update(invitation).set({ status: "canceled" }).where(eq(invitation.id, id))
    return c.body(null, 204)
  })

  app.openapi(acceptInvitationRoute, async (c) => {
    const scope = c.var.scope
    assertSessionActor(scope, "Accept an invitation from a signed-in session.")
    const { id } = c.req.valid("param")
    const row = await loadPendingInvitation(db, id)

    const [sessionUser] = await db.select({ email: user.email }).from(user).where(eq(user.id, scope.actor.userId)).limit(1)
    if (sessionUser === undefined) throw new Error("Session user not found.")
    // Same *mailbox*, not same string: Gmail ignores dots, `+tags` route to the base address
    // (packages/core/src/email.ts). The invitation reached this person's inbox by definition.
    if (!sameMailbox(sessionUser.email, row.email)) {
      throw new PostbagError(
        "invitation_email_mismatch",
        "This invitation was sent to a different email address than the one you're signed in with.",
      )
    }

    const role = row.role === "owner" || row.role === "admin" ? row.role : "member"
    const [alreadyMember] = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, row.organizationId), eq(member.userId, scope.actor.userId)))
      .limit(1)
    if (alreadyMember === undefined) {
      await db.insert(member).values({
        id: globalThis.crypto.randomUUID(),
        organizationId: row.organizationId,
        userId: scope.actor.userId,
        role,
      })
    }
    await db.update(invitation).set({ status: "accepted" }).where(eq(invitation.id, id))
    await setActiveOrganizationWithCookies(c, auth, c.req.raw.headers, row.organizationId)

    const [org] = await db.select().from(organization).where(eq(organization.id, row.organizationId)).limit(1)
    if (org === undefined) throw new Error("Organization not found after accepting invitation.")

    await db.insert(events).values({
      id: newId("ev"),
      organizationId: row.organizationId,
      type: "member.joined",
      subject: { user_id: scope.actor.userId },
      data: { role, invitation_id: row.id },
    })

    const body: z.infer<typeof AcceptInvitationResponseSchema> = {
      organization: { id: org.id, slug: org.slug, name: org.name },
      role,
      next: [{ why: "See who else is here", method: "GET", path: "/v1/members" }],
    }
    return c.json(body)
  })
}
