import { describe, expect, it } from "vitest"

import { testEnv } from "../testUtils.js"
import { buildBillingProvider } from "./billingProvider.js"

describe("Polar webhook verification", () => {
  it("rejects an invalid Standard Webhooks signature before accepting an event", () => {
    const provider = buildBillingProvider(
      testEnv({
        POLAR_WEBHOOK_SECRET: "whsec_c2lnbmF0dXJlX3Rlc3Rfc2VjcmV0",
      }),
    )
    if (provider === null) throw new Error("expected billing provider")
    const headers = new Headers({
      "webhook-id": "evt_invalid",
      "webhook-timestamp": String(Math.floor(Date.now() / 1_000)),
      "webhook-signature": "v1,invalid",
    })
    expect(() => provider.verifyWebhook('{"type":"subscription.active"}', headers)).toThrow()
  })
})
