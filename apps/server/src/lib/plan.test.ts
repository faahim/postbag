import { PostbagError } from "@postbag/core"
import { describe, expect, it } from "vitest"

import { canStartCheckout, DEFAULT_PLAN_LIMITS, limitsFor, PLAN_ORDER } from "./plan.js"

describe("limitsFor", () => {
  it("falls back to free limits for an unrecognized plan string", () => {
    expect(limitsFor("not-a-real-plan", {})).toEqual(DEFAULT_PLAN_LIMITS.free)
  })

  it("stored overrides win over plan defaults", () => {
    expect(limitsFor("pro", { forms: 999 })).toEqual({ ...DEFAULT_PLAN_LIMITS.pro, forms: 999 })
  })
})

describe("PLAN_ORDER", () => {
  it("ranks tiers free < pro < team < selfhost", () => {
    expect(PLAN_ORDER.free).toBeLessThan(PLAN_ORDER.pro)
    expect(PLAN_ORDER.pro).toBeLessThan(PLAN_ORDER.team)
    expect(PLAN_ORDER.team).toBeLessThan(PLAN_ORDER.selfhost)
  })
})

describe("canStartCheckout — job K checkout guard", () => {
  it("refuses checkout for a complimentary org with 409 plan_is_complimentary", () => {
    expect(() => {
      canStartCheckout("complimentary")
    }).toThrow(PostbagError)
    try {
      canStartCheckout("complimentary")
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(PostbagError)
      const postbagError = error as PostbagError
      expect(postbagError.code).toBe("plan_is_complimentary")
      expect(postbagError.status).toBe(409)
      expect(postbagError.hint.length).toBeGreaterThan(0)
    }
  })

  it("allows checkout for free, billing and selfhost orgs", () => {
    for (const planSource of ["free", "billing", "selfhost"] as const) {
      expect(() => {
        canStartCheckout(planSource)
      }).not.toThrow()
    }
  })
})
