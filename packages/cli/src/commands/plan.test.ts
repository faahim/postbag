import { describe, expect, it } from "vitest"

import { createHarness } from "../lib/testHarness.js"
import { main } from "../main.js"

describe("postbag plan (job K)", () => {
  it("plan — reads /v1/me and prints tier + source + expiry + note", async () => {
    const harness = createHarness({
      env: { POSTBAG_API_KEY: "pb_live_test" },
      handleFetch: () => ({
        status: 200,
        body: {
          organization: {
            id: "org_1",
            slug: "acme",
            name: "Acme",
            plan: "pro",
            plan_source: "complimentary",
            plan_expires_at: "2027-01-01T00:00:00.000Z",
            plan_note: "Courtesy of Postbag",
            timezone: "UTC",
          },
          key: { scopes: ["manage"] },
          counts: { projects: 0, forms: 0, streams: 0, destinations: 0, routes: 0 },
          limits: { forms: 50, submissions_per_month: 50000, destinations: 50, retention_days: 365, used: { forms: 0, submissions_this_month: 0 } },
          next: [],
        },
      }),
    })

    await main(["node", "postbag", "--json", "plan"], harness.deps)

    const [req] = harness.requests
    expect(req?.url).toBe("https://postbag.dev/v1/me")
    expect(req?.method).toBe("GET")
    const printed = JSON.parse(harness.logs[0] ?? "{}") as { plan: string; plan_source: string; plan_note: string }
    expect(printed.plan).toBe("pro")
    expect(printed.plan_source).toBe("complimentary")
    expect(printed.plan_note).toBe("Courtesy of Postbag")
  })

  it("plan redeem <code> — posts to /v1/plan/redeem", async () => {
    const harness = createHarness({
      env: { POSTBAG_API_KEY: "pb_live_test" },
      handleFetch: () => ({
        status: 200,
        body: { plan: "pro", plan_source: "complimentary", plan_expires_at: null, plan_note: "Courtesy of Postbag", next: [] },
      }),
    })

    await main(["node", "postbag", "--json", "plan", "redeem", "the-code"], harness.deps)

    const [req] = harness.requests
    expect(req?.url).toBe("https://postbag.dev/v1/plan/redeem")
    expect(req?.method).toBe("POST")
    expect(JSON.parse(req?.body ?? "{}")).toEqual({ code: "the-code" })
    const printed = JSON.parse(harness.logs[0] ?? "{}") as { plan_source: string }
    expect(printed.plan_source).toBe("complimentary")
  })

  it("plan redeem — renders an API error and exits 1", async () => {
    const harness = createHarness({
      env: { POSTBAG_API_KEY: "pb_live_test" },
      handleFetch: () => ({
        status: 404,
        body: { error: { code: "grant_not_found", message: "No plan grant matches that code.", hint: "Check the code and try again." } },
      }),
    })

    process.exitCode = 0
    await main(["node", "postbag", "--json", "plan", "redeem", "bogus"], harness.deps)
    expect(process.exitCode).toBe(1)
    process.exitCode = 0
    const printed = JSON.parse(harness.errors[0] ?? "{}") as { error: { code: string } }
    expect(printed.error.code).toBe("grant_not_found")
  })
})
