import { organization, organizationSettings, type Database } from "@postbag/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { BillingProvider, BillingWebhookEvent } from "../../lib/billingProvider.js"
import {
  buildHarness,
  createTestApiKey,
  seedOrganization,
  signUpTestUser,
  TEST_DATABASE_URL,
  type TestHarness,
} from "../../testUtils.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

integration("billing API", () => {
  let harness: TestHarness
  let db: Database
  let organizationId: string
  let apiKey: string
  let checkoutInput: Parameters<BillingProvider["createCheckout"]>[0] | undefined

  const activeEvent: BillingWebhookEvent = {
    type: "subscription.active",
    timestamp: "2026-08-23T00:00:00.000Z",
    data: {
      id: "sub_test",
      status: "active",
      product_id: "prod_pro_month",
      customer_id: "cus_test",
      current_period_end: "2026-09-23T00:00:00.000Z",
      cancel_at_period_end: false,
      customer: { external_id: "" },
    },
  }

  const provider: BillingProvider = {
    async createCheckout(input) {
      checkoutInput = input
      return Promise.resolve("https://sandbox.polar.sh/checkout/test")
    },
    async createPortal() {
      return Promise.resolve("https://sandbox.polar.sh/portal/test")
    },
    verifyWebhook() {
      return activeEvent
    },
  }

  beforeAll(async () => {
    harness = buildHarness(
      {
        POLAR_ACCESS_TOKEN: "polar_test",
        POLAR_WEBHOOK_SECRET: "whsec_test",
        POLAR_PRO_MONTHLY_PRODUCT_ID: "prod_pro_month",
      },
      {},
      provider,
    )
    db = harness.db
    const seeded = await seedOrganization(db, "Billing Org")
    organizationId = seeded.organizationId
    activeEvent.data.customer.external_id = organizationId
    apiKey = await createTestApiKey(harness.auth, organizationId, seeded.userId)
  })

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, organizationId))
    await harness.close()
  })

  function authed(init: RequestInit = {}): RequestInit {
    const headers = new Headers(init.headers)
    headers.set("authorization", `Bearer ${apiKey}`)
    return { ...init, headers }
  }

  it("creates a checkout for the authenticated organization", async () => {
    const response = await harness.app.request(
      "/v1/billing/checkout",
      authed({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "pro", interval: "month" }),
      }),
    )
    expect(response.status).toBe(201)
    expect((await response.json()) as { url: string }).toEqual({ url: "https://sandbox.polar.sh/checkout/test" })
    expect(checkoutInput?.organizationId).toBe(organizationId)
  })

  it("persists a verified webhook and changes plan only through its processor", async () => {
    const response = await harness.app.request("/v1/billing/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "webhook-id": "evt_subscription_active" },
      body: JSON.stringify(activeEvent),
    })
    expect(response.status).toBe(202)
    const [settings] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
    expect(settings?.plan).toBe("pro")
    expect(settings?.planSource).toBe("billing")
    expect(settings?.billingSubscriptionId).toBe("sub_test")

    const duplicate = await harness.app.request("/v1/billing/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "webhook-id": "evt_subscription_active" },
      body: JSON.stringify(activeEvent),
    })
    expect(duplicate.status).toBe(202)
  })
})

integration("billing disabled", () => {
  it("returns an agent-native 501 from checkout", async () => {
    const harness = buildHarness({ POLAR_ACCESS_TOKEN: undefined }, {}, null)
    const signedUp = await signUpTestUser(harness.app, "Self-host Billing User")
    let createdOrganizationId: string | undefined
    try {
      const me = await harness.app.request("/v1/me", { headers: { cookie: signedUp.cookie } })
      const meBody = (await me.json()) as { organization: { id: string; plan: string; plan_source: string } }
      createdOrganizationId = meBody.organization.id
      expect(meBody.organization.plan).toBe("selfhost")
      expect(meBody.organization.plan_source).toBe("selfhost")
      const response = await harness.app.request("/v1/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: signedUp.cookie },
        body: JSON.stringify({ plan: "pro", interval: "month" }),
      })
      expect(response.status).toBe(501)
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe("billing_disabled")
    } finally {
      if (createdOrganizationId !== undefined) {
        await harness.db.delete(organization).where(eq(organization.id, createdOrganizationId))
      }
      await harness.close()
    }
  })
})

integration("self-host billing guard", () => {
  it("refuses hosted checkout for a self-hosted organization even when a provider is configured", async () => {
    const provider: BillingProvider = {
      createCheckout() {
        return Promise.reject(new Error("checkout must not be called"))
      },
      createPortal() {
        return Promise.reject(new Error("portal must not be called"))
      },
      verifyWebhook() {
        return null
      },
    }
    const harness = buildHarness({ POLAR_ACCESS_TOKEN: "polar_test" }, {}, provider)
    const seeded = await seedOrganization(harness.db, "Self-host Checkout Guard Org")
    try {
      await harness.db
        .update(organizationSettings)
        .set({ plan: "selfhost", planSource: "selfhost" })
        .where(eq(organizationSettings.organizationId, seeded.organizationId))
      const key = await createTestApiKey(harness.auth, seeded.organizationId, seeded.userId)
      const response = await harness.app.request("/v1/billing/checkout", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ plan: "pro", interval: "month" }),
      })
      expect(response.status).toBe(501)
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe("billing_disabled")
    } finally {
      await harness.db.delete(organization).where(eq(organization.id, seeded.organizationId))
      await harness.close()
    }
  })
})
