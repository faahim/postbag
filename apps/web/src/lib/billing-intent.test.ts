import { describe, expect, it } from "vitest"

import { billingIntentFromSearch, billingIntentSearchSchema } from "./billing-intent"

describe("billing checkout intent", () => {
  it("returns the selected paid plan and interval when checkout was requested", () => {
    // Given: a validated Settings search created by a public pricing CTA.
    const search = billingIntentSearchSchema.parse({ plan: "team", interval: "year", checkout: 1 })

    // When: Settings resolves the checkout intent.
    const intent = billingIntentFromSearch(search)

    // Then: the exact plan and interval survive authentication.
    expect(intent).toEqual({ plan: "team", interval: "year" })
  })

  it("does not start checkout from a partial or passive Settings search", () => {
    // Given: Settings searches without the explicit one-shot checkout marker.
    const partial = billingIntentSearchSchema.parse({ plan: "pro", interval: "month" })
    const empty = billingIntentSearchSchema.parse({})

    // When / Then: neither search becomes an automatic checkout intent.
    expect(billingIntentFromSearch(partial)).toBeNull()
    expect(billingIntentFromSearch(empty)).toBeNull()
  })

  it("rejects unsupported plans and intervals at the route boundary", () => {
    // Given / When: an untrusted Settings query contains unsupported billing values.
    const invalid = billingIntentSearchSchema.safeParse({ plan: "free", interval: "week", checkout: "1" })

    // Then: the boundary rejects it before billing code sees it.
    expect(invalid.success).toBe(false)
  })
})
