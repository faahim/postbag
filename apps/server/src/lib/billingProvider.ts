import { Polar } from "@polar-sh/sdk"
import { validateEvent } from "@polar-sh/sdk/webhooks"
import { PostbagError } from "@postbag/core"
import { z } from "zod"

import type { Env } from "../env.js"

const SubscriptionWebhookSchema = z.object({
  timestamp: z.iso.datetime(),
  type: z.enum([
    "subscription.created",
    "subscription.updated",
    "subscription.active",
    "subscription.canceled",
    "subscription.uncanceled",
    "subscription.revoked",
    "subscription.past_due",
    "subscription.paused",
    "subscription.resumed",
  ]),
  data: z.object({
    id: z.string(),
    status: z.string(),
    product_id: z.string(),
    customer_id: z.string(),
    current_period_end: z.string(),
    cancel_at_period_end: z.boolean(),
    customer: z.object({ external_id: z.string().nullable().optional() }),
  }),
})

export type BillingWebhookEvent = z.infer<typeof SubscriptionWebhookSchema>
export type BillingPlan = "pro" | "team"
export type BillingInterval = "month" | "year"

export type BillingProvider = {
  createCheckout(input: {
    readonly organizationId: string
    readonly plan: BillingPlan
    readonly interval: BillingInterval
    readonly successUrl: string
    readonly returnUrl: string
  }): Promise<string>
  createPortal(organizationId: string, returnUrl: string): Promise<string>
  verifyWebhook(body: string, headers: Headers): BillingWebhookEvent | null
}

export function parseBillingWebhookEvent(payload: unknown): BillingWebhookEvent {
  return SubscriptionWebhookSchema.parse(payload)
}

function productId(env: Env, plan: BillingPlan, interval: BillingInterval): string {
  const value =
    plan === "pro"
      ? interval === "month"
        ? env.POLAR_PRO_MONTHLY_PRODUCT_ID
        : env.POLAR_PRO_YEARLY_PRODUCT_ID
      : interval === "month"
        ? env.POLAR_TEAM_MONTHLY_PRODUCT_ID
        : env.POLAR_TEAM_YEARLY_PRODUCT_ID
  if (value === undefined) {
    throw new PostbagError("billing_product_unavailable", `${plan} ${interval}ly billing is not configured.`)
  }
  return value
}

export function buildBillingProvider(env: Env): BillingProvider | null {
  if (env.POLAR_ACCESS_TOKEN === undefined) return null
  const polar = new Polar({ accessToken: env.POLAR_ACCESS_TOKEN, server: env.POLAR_SERVER })

  return {
    async createCheckout(input) {
      const checkout = await polar.checkouts.create({
        products: [productId(env, input.plan, input.interval)],
        externalCustomerId: input.organizationId,
        metadata: { organization_id: input.organizationId, postbag_plan: input.plan },
        successUrl: input.successUrl,
        returnUrl: input.returnUrl,
      })
      return checkout.url
    },
    async createPortal(organizationId, returnUrl) {
      const session = await polar.customerSessions.create({ externalCustomerId: organizationId, returnUrl })
      return session.customerPortalUrl
    },
    verifyWebhook(body, headers) {
      if (env.POLAR_WEBHOOK_SECRET === undefined) {
        throw new PostbagError("billing_disabled", "Polar webhook verification is not configured.")
      }
      const webhookHeaders: Record<string, string> = {}
      headers.forEach((value, key) => {
        webhookHeaders[key] = value
      })
      validateEvent(body, webhookHeaders, env.POLAR_WEBHOOK_SECRET)
      const parsed = SubscriptionWebhookSchema.safeParse(JSON.parse(body))
      return parsed.success ? parsed.data : null
    },
  }
}
