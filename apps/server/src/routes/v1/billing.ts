import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { PostbagError } from "@postbag/core"
import { billingEvents, organizationSettings, type Database } from "@postbag/db"
import { eq } from "drizzle-orm"

import type { Env } from "../../env.js"
import type { BillingProvider } from "../../lib/billingProvider.js"
import { canStartCheckout } from "../../lib/plan.js"
import { assertScope, type AppEnv } from "../../lib/scope.js"
import type { Logger } from "../../logger.js"
import { errorResponses } from "../../schemas.js"
import { runBillingEventSweep } from "../../worker/billing.js"

const BillingStatusSchema = z.object({
  enabled: z.boolean(),
  plan: z.string(),
  plan_source: z.string(),
  subscription: z
    .object({
      id: z.string(),
      status: z.string(),
      current_period_end: z.string().nullable(),
      cancel_at_period_end: z.boolean(),
    })
    .nullable(),
  products: z.object({
    pro: z.object({ month: z.boolean(), year: z.boolean() }),
    team: z.object({ month: z.boolean(), year: z.boolean() }),
  }),
})

const statusRoute = createRoute({
  method: "get",
  path: "/v1/billing",
  operationId: "billing_get",
  tags: ["billing"],
  summary: "Get billing status and purchasable plans",
  responses: { 200: { description: "ok", content: { "application/json": { schema: BillingStatusSchema } } } },
})

const checkoutRoute = createRoute({
  method: "post",
  path: "/v1/billing/checkout",
  operationId: "billing_checkout",
  tags: ["billing"],
  summary: "Start a Polar checkout",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ plan: z.enum(["pro", "team"]), interval: z.enum(["month", "year"]) }),
        },
      },
    },
  },
  responses: {
    201: { description: "checkout created", content: { "application/json": { schema: z.object({ url: z.url() }) } } },
    ...errorResponses,
  },
})

const portalRoute = createRoute({
  method: "post",
  path: "/v1/billing/portal",
  operationId: "billing_portal",
  tags: ["billing"],
  summary: "Open the Polar customer portal",
  responses: {
    201: { description: "portal session created", content: { "application/json": { schema: z.object({ url: z.url() }) } } },
    ...errorResponses,
  },
})

function requireBilling(provider: BillingProvider | null): BillingProvider {
  if (provider === null) throw new PostbagError("billing_disabled", "Billing is disabled on this Postbag instance.")
  return provider
}

export function registerPublicBillingRoutes(
  app: OpenAPIHono<AppEnv>,
  db: Database,
  provider: BillingProvider | null,
  env: Env,
  logger: Logger,
): void {
  app.post("/v1/billing/webhook", async (c) => {
    const billing = requireBilling(provider)
    const providerEventId = c.req.header("webhook-id")
    if (providerEventId === undefined) {
      throw new PostbagError("validation_failed", "The webhook-id header is required.")
    }
    const body = await c.req.text()
    let event
    try {
      event = billing.verifyWebhook(body, c.req.raw.headers)
    } catch (error) {
      if (error instanceof PostbagError) throw error
      throw new PostbagError("forbidden", "The Polar webhook signature is invalid.")
    }
    if (event === null) return c.body(null, 202)
    const organizationId = event.data.customer.external_id
    if (organizationId === undefined || organizationId === null) {
      throw new PostbagError("validation_failed", "The Polar customer has no Postbag organization id.")
    }
    await db
      .insert(billingEvents)
      .values({
        organizationId,
        providerEventId,
        type: event.type,
        payload: event,
      })
      .onConflictDoNothing({ target: billingEvents.providerEventId })
    await runBillingEventSweep(db, env, logger)
    return c.body(null, 202)
  })
}

export function registerBillingRoutes(
  app: OpenAPIHono<AppEnv>,
  db: Database,
  provider: BillingProvider | null,
  env: Env,
): void {
  app.openapi(statusRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "read")
    const [settings] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, scope.organizationId))
      .limit(1)
    if (settings === undefined) throw new Error("Organization settings not found.")
    return c.json({
      enabled: provider !== null,
      plan: settings.plan,
      plan_source: settings.planSource,
      subscription:
        settings.billingSubscriptionId === null
          ? null
          : {
              id: settings.billingSubscriptionId,
              status: settings.billingSubscriptionStatus ?? "unknown",
              current_period_end: settings.billingCurrentPeriodEnd?.toISOString() ?? null,
              cancel_at_period_end: settings.billingCancelAtPeriodEnd,
            },
      products: {
        pro: {
          month: env.POLAR_PRO_MONTHLY_PRODUCT_ID !== undefined,
          year: env.POLAR_PRO_YEARLY_PRODUCT_ID !== undefined,
        },
        team: {
          month: env.POLAR_TEAM_MONTHLY_PRODUCT_ID !== undefined,
          year: env.POLAR_TEAM_YEARLY_PRODUCT_ID !== undefined,
        },
      },
    })
  })

  app.openapi(checkoutRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const billing = requireBilling(provider)
    const [settings] = await db
      .select({ planSource: organizationSettings.planSource })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, scope.organizationId))
      .limit(1)
    if (settings === undefined) throw new Error("Organization settings not found.")
    canStartCheckout(settings.planSource)
    const input = c.req.valid("json")
    const returnUrl = `${env.APP_URL}/app/settings`
    const url = await billing.createCheckout({
      organizationId: scope.organizationId,
      plan: input.plan,
      interval: input.interval,
      successUrl: `${returnUrl}?billing=success`,
      returnUrl,
    })
    return c.json({ url }, 201)
  })

  app.openapi(portalRoute, async (c) => {
    const scope = c.var.scope
    assertScope(scope, "manage")
    const billing = requireBilling(provider)
    const url = await billing.createPortal(scope.organizationId, `${env.APP_URL}/app/settings`)
    return c.json({ url }, 201)
  })
}
