import { createRoute, type OpenAPIHono, type z } from "@hono/zod-openapi"
import { newId, PostbagError, type Plan } from "@postbag/core"
import { eq } from "drizzle-orm"
import { events, organizationSettings, planGrantRedemptions, planGrants, type Database } from "@postbag/db"

import { hashGrantCode } from "../../lib/grantCode.js"
import { PLAN_ORDER } from "../../lib/plan.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import { ErrorEnvelopeSchema, errorResponses, PlanRedeemInputSchema, PlanRedeemResponseSchema } from "../../schemas.js"

// Job K — redeeming is org-scoped, done by the org's own owner (any `manage`-scoped
// credential — a session actor's scope always includes `manage`, so "session owner" and
// "manage key" are the same check here). Effects: plan, plan_source='complimentary',
// plan_note and plan_expires_at all change together, redeemed_count increments, a
// redemption row is written, and organization.plan.changed fires with before/after —
// exactly the "the database makes it correct" discipline the rest of the API follows.
const redeemRoute = createRoute({
  method: "post",
  path: "/v1/plan/redeem",
  operationId: "plan_redeem",
  tags: ["plan"],
  summary: "Redeem a complimentary-access grant code for the active organization",
  description:
    "Requires the manage scope (a session is always manage-scoped). A code minted by " +
    "POST /v1/admin/plan-grants sets plan, plan_source='complimentary', plan_note and — if the " +
    "grant has a plan_duration_days — plan_expires_at. A paying org (plan_source='billing') cannot " +
    "redeem (409 plan_is_billing: cancel the subscription first); redeeming a lower tier than the " +
    "org's current plan is refused (409 plan_not_upgrade).",
  request: { body: { content: { "application/json": { schema: PlanRedeemInputSchema } } } },
  responses: {
    200: { description: "ok", content: { "application/json": { schema: PlanRedeemResponseSchema } } },
    ...errorResponses,
    410: { description: "The code is expired, revoked, or fully redeemed", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  },
})

export function registerPlanRoutes(app: OpenAPIHono<AppEnv>, db: Database): void {
  app.openapi(redeemRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const { code } = c.req.valid("json")

    const codeHash = hashGrantCode(code)
    const [grant] = await db.select().from(planGrants).where(eq(planGrants.codeHash, codeHash)).limit(1)
    if (grant === undefined) throw new PostbagError("grant_not_found", "No plan grant matches that code.")
    if (grant.revokedAt !== null) throw new PostbagError("grant_revoked", "This code was revoked.")
    if (grant.expiresAt !== null && grant.expiresAt.getTime() < Date.now()) {
      throw new PostbagError("grant_expired", "This code has expired.")
    }
    if (grant.redeemedCount >= grant.maxRedemptions) {
      throw new PostbagError("grant_exhausted", "This code has already been redeemed the maximum number of times.")
    }

    const [settingsRow] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, scope.organizationId))
      .limit(1)
    if (settingsRow === undefined) throw new Error(`No organization_settings row for organization ${scope.organizationId}.`)

    // canStartCheckout's mirror image: billing code must never be undercut by a
    // complimentary redemption either, so a paying org must cancel first.
    if (settingsRow.planSource === "billing") {
      throw new PostbagError("plan_is_billing", "This organization already pays for its plan.")
    }
    const currentPlan = settingsRow.plan as Plan
    const grantedPlan = grant.plan as Plan
    if (PLAN_ORDER[grantedPlan] < PLAN_ORDER[currentPlan]) {
      throw new PostbagError("plan_not_upgrade", `'${grantedPlan}' is not higher than the organization's current plan '${currentPlan}'.`)
    }

    const now = new Date()
    const planExpiresAt =
      grant.planDurationDays === null ? null : new Date(now.getTime() + grant.planDurationDays * 24 * 60 * 60 * 1000)
    const planNote = grant.note ?? "Courtesy of Postbag"

    const before = {
      plan: settingsRow.plan,
      plan_source: settingsRow.planSource,
      plan_expires_at: settingsRow.planExpiresAt?.toISOString() ?? null,
      plan_note: settingsRow.planNote,
    }
    const after = {
      plan: grantedPlan,
      plan_source: "complimentary" as const,
      plan_expires_at: planExpiresAt?.toISOString() ?? null,
      plan_note: planNote,
    }

    await db.transaction(async (tx) => {
      await tx
        .update(organizationSettings)
        .set({
          plan: grantedPlan,
          planSource: "complimentary",
          planNote,
          planExpiresAt,
          updatedAt: now,
        })
        .where(eq(organizationSettings.organizationId, scope.organizationId))

      await tx.update(planGrants).set({ redeemedCount: grant.redeemedCount + 1 }).where(eq(planGrants.id, grant.id))

      await tx.insert(planGrantRedemptions).values({
        id: newId("pgr"),
        grantId: grant.id,
        organizationId: scope.organizationId,
        redeemedAt: now,
      })

      await tx.insert(events).values({
        id: newId("ev"),
        organizationId: scope.organizationId,
        type: "organization.plan.changed",
        subject: { organization_id: scope.organizationId },
        data: { before, after, reason: "complimentary_redeemed" },
      })
    })

    const body: z.infer<typeof PlanRedeemResponseSchema> = { ...after, next: [] }
    return c.json(body, 200)
  })
}
