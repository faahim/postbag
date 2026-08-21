import { describe, expect, it } from "vitest"

import { createHarness } from "../lib/testHarness.js"
import { main } from "../main.js"

describe("postbag admin plan-grants (job K)", () => {
  it("create — posts flags to /v1/admin/plan-grants and prints the once-shown code", async () => {
    const harness = createHarness({
      env: { POSTBAG_API_KEY: "pb_live_test" },
      handleFetch: () => ({
        status: 201,
        body: {
          id: "pg_abc123",
          code: "raw-code-shown-once",
          plan: "pro",
          note: "friend",
          expires_at: null,
          plan_duration_days: 365,
          max_redemptions: 1,
          redeemed_count: 0,
          created_by_user_id: "usr_1",
          created_at: "2026-08-21T00:00:00.000Z",
          revoked_at: null,
        },
      }),
    })

    await main(
      ["node", "postbag", "--json", "admin", "plan-grants", "create", "--plan", "pro", "--note", "friend", "--days", "365"],
      harness.deps,
    )

    const [req] = harness.requests
    expect(req?.url).toBe("https://postbag.dev/v1/admin/plan-grants")
    expect(req?.method).toBe("POST")
    expect(JSON.parse(req?.body ?? "{}")).toEqual({ plan: "pro", note: "friend", plan_duration_days: 365 })
    const printed = JSON.parse(harness.logs[0] ?? "{}") as { code: string }
    expect(printed.code).toBe("raw-code-shown-once")
  })

  it("list — GETs /v1/admin/plan-grants", async () => {
    const harness = createHarness({
      env: { POSTBAG_API_KEY: "pb_live_test" },
      handleFetch: () => ({ status: 200, body: [] }),
    })

    await main(["node", "postbag", "--json", "admin", "plan-grants", "list"], harness.deps)

    const [req] = harness.requests
    expect(req?.url).toBe("https://postbag.dev/v1/admin/plan-grants")
    expect(req?.method).toBe("GET")
  })

  it("revoke <id> — posts to /v1/admin/plan-grants/{id}/revoke", async () => {
    const harness = createHarness({
      env: { POSTBAG_API_KEY: "pb_live_test" },
      handleFetch: () => ({
        status: 200,
        body: {
          id: "pg_abc123",
          plan: "pro",
          note: null,
          expires_at: null,
          plan_duration_days: null,
          max_redemptions: 1,
          redeemed_count: 0,
          created_by_user_id: "usr_1",
          created_at: "2026-08-21T00:00:00.000Z",
          revoked_at: "2026-08-21T01:00:00.000Z",
        },
      }),
    })

    await main(["node", "postbag", "--json", "admin", "plan-grants", "revoke", "pg_abc123"], harness.deps)

    const [req] = harness.requests
    expect(req?.url).toBe("https://postbag.dev/v1/admin/plan-grants/pg_abc123/revoke")
    expect(req?.method).toBe("POST")
  })

  it("mint 404 (not a platform admin) renders not_found and exits 1", async () => {
    const harness = createHarness({
      env: { POSTBAG_API_KEY: "pb_live_test" },
      handleFetch: () => ({ status: 404, body: { error: { code: "not_found", message: "Not found.", hint: "Check the id and organization scope." } } }),
    })

    process.exitCode = 0
    await main(["node", "postbag", "--json", "admin", "plan-grants", "create", "--plan", "pro"], harness.deps)
    expect(process.exitCode).toBe(1)
    process.exitCode = 0
    const printed = JSON.parse(harness.errors[0] ?? "{}") as { error: { code: string } }
    expect(printed.error.code).toBe("not_found")
  })
})
