import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { newId, PostbagError, type Plan } from "@postbag/core"
import { desc, eq } from "drizzle-orm"
import { planGrants, type Database } from "@postbag/db"

import type { Env } from "../../env.js"
import { generateGrantCode, hashGrantCode } from "../../lib/grantCode.js"
import { requirePlatformAdmin } from "../../lib/platformAdmin.js"
import type { AppEnv } from "../../lib/scope.js"
import { errorResponses, IdSchema, PlanGrantCreateInputSchema, PlanGrantCreatedSchema, PlanGrantSummarySchema } from "../../schemas.js"

// Job K — complimentary access, minted without touching any tenant (golden rule 6: "no
// cross-tenant query ever, including 'just for admin'"). These three endpoints are the
// *only* platform-admin surface in the API, and are gated the same way on all three:
// `PLATFORM_ADMIN_EMAILS` is a comma-separated env var, empty by default, so a
// self-hosted operator who never sets it never learns these endpoints exist — every
// non-admin caller (including a perfectly valid session/key on some other org) gets
// `404 not_found`, never `403`. Admin status is resolved from the caller: a session
// actor's own email, or — for an API key — the *owner* member's email of the key's
// organization (see lib/platformAdmin.ts). No endpoint here lists or modifies another
// organization's rows; minting only ever writes a row with no organization_id at all.
const ADMIN_GATE_DESCRIPTION =
  "Platform-admin only: allowed when the caller's email (the session user's email, or — for an API key — " +
  "the owner member's email of the key's organization) is in the server's PLATFORM_ADMIN_EMAILS env var " +
  "(comma-separated, empty by default). Any other caller gets 404 not_found, not 403, so a self-hosted " +
  "operator who never sets PLATFORM_ADMIN_EMAILS never sees this endpoint exist."

function serializeGrant(row: typeof planGrants.$inferSelect): z.infer<typeof PlanGrantSummarySchema> {
  return {
    id: row.id,
    plan: row.plan as Plan,
    note: row.note,
    expires_at: row.expiresAt?.toISOString() ?? null,
    plan_duration_days: row.planDurationDays,
    max_redemptions: row.maxRedemptions,
    redeemed_count: row.redeemedCount,
    created_by_user_id: row.createdByUserId,
    created_at: row.createdAt.toISOString(),
    revoked_at: row.revokedAt?.toISOString() ?? null,
  }
}

const createGrantRoute = createRoute({
  method: "post",
  path: "/v1/admin/plan-grants",
  operationId: "admin_plan_grants_create",
  tags: ["admin"],
  summary: "Mint a complimentary-access grant code (platform admin only)",
  description:
    `${ADMIN_GATE_DESCRIPTION} Touches no tenant — the code is redeemed by an org's own owner ` +
    "with POST /v1/plan/redeem, which is where plan_source actually changes.",
  request: { body: { content: { "application/json": { schema: PlanGrantCreateInputSchema } } } },
  responses: {
    201: { description: "created", content: { "application/json": { schema: PlanGrantCreatedSchema } } },
    ...errorResponses,
  },
})

const listGrantsRoute = createRoute({
  method: "get",
  path: "/v1/admin/plan-grants",
  operationId: "admin_plan_grants_list",
  tags: ["admin"],
  summary: "List plan grants (platform admin only; hashed codes never returned)",
  description: ADMIN_GATE_DESCRIPTION,
  responses: {
    200: { description: "ok", content: { "application/json": { schema: z.array(PlanGrantSummarySchema) } } },
    ...errorResponses,
  },
})

const revokeGrantRoute = createRoute({
  method: "post",
  path: "/v1/admin/plan-grants/{id}/revoke",
  operationId: "admin_plan_grants_revoke",
  tags: ["admin"],
  summary: "Revoke a plan grant so it can no longer be redeemed (platform admin only)",
  description: `${ADMIN_GATE_DESCRIPTION} Idempotent — revoking an already-revoked grant just returns it.`,
  request: { params: z.object({ id: IdSchema }) },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: PlanGrantSummarySchema } } },
    ...errorResponses,
  },
})

export function registerPlanGrantRoutes(app: OpenAPIHono<AppEnv>, db: Database, env: Env): void {
  app.openapi(createGrantRoute, async (c) => {
    const scope = c.var.scope
    const admin = await requirePlatformAdmin(db, scope, env.PLATFORM_ADMIN_EMAILS)
    const body = c.req.valid("json")

    const code = generateGrantCode()
    const [created] = await db
      .insert(planGrants)
      .values({
        id: newId("pg"),
        codeHash: hashGrantCode(code),
        plan: body.plan,
        note: body.note ?? null,
        planDurationDays: body.plan_duration_days ?? null,
        expiresAt: body.expires_at === undefined ? null : new Date(body.expires_at),
        maxRedemptions: body.max_redemptions,
        createdByUserId: admin.userId,
      })
      .returning()
    if (created === undefined) throw new Error("Failed to mint plan grant.")

    return c.json({ ...serializeGrant(created), code }, 201)
  })

  app.openapi(listGrantsRoute, async (c) => {
    const scope = c.var.scope
    await requirePlatformAdmin(db, scope, env.PLATFORM_ADMIN_EMAILS)
    const rows = await db.select().from(planGrants).orderBy(desc(planGrants.createdAt))
    return c.json(rows.map(serializeGrant))
  })

  app.openapi(revokeGrantRoute, async (c) => {
    const scope = c.var.scope
    await requirePlatformAdmin(db, scope, env.PLATFORM_ADMIN_EMAILS)
    const { id } = c.req.valid("param")
    const [existing] = await db.select().from(planGrants).where(eq(planGrants.id, id)).limit(1)
    if (existing === undefined) throw new PostbagError("not_found", "No plan grant with that id.")
    if (existing.revokedAt !== null) return c.json(serializeGrant(existing), 200)

    const [revoked] = await db
      .update(planGrants)
      .set({ revokedAt: new Date() })
      .where(eq(planGrants.id, id))
      .returning()
    if (revoked === undefined) throw new Error("Failed to revoke plan grant.")
    return c.json(serializeGrant(revoked), 200)
  })
}
