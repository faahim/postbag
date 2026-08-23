import { describe, expect, it } from "vitest"

import { createHarness } from "../lib/testHarness.js"
import { main } from "../main.js"

const sandboxId = "fm_23456789abcd"
const sandboxToken = `pbs_${sandboxId}.${"A".repeat(43)}`

describe("postbag sandbox", () => {
  it("creates without an API key and does not send Bearer auth", async () => {
    const harness = createHarness({
      handleFetch: (request) => {
        expect(request.url).toBe("https://postbag.dev/v1/public/sandboxes")
        expect(request.headers["authorization"]).toBeUndefined()
        expect(request.headers["idempotency-key"]).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
        )
        expect(JSON.parse(request.body ?? "{}")).toEqual({
          name: "Contact",
          origin: "https://example.com",
        })
        return {
          status: 201,
          body: {
            sandbox: {
              id: sandboxId,
              name: "Contact",
              status: "active",
              submit_url: `https://postbag.dev/s/${sandboxId}`,
              expires_at: "2026-08-24T00:00:00.000Z",
              accepted_count: 0,
              remaining: 5,
            },
            sandbox_token: sandboxToken,
            authorization: { scheme: "Sandbox", example: `Sandbox ${sandboxToken}` },
            embed: { html: "", fetch: "", react: "", astro: "", nextjs_action: "" },
            verify: { curl: "", then: "" },
            claim_url: `https://postbag.dev/app/claim#token=${sandboxToken}`,
            next: [],
          },
        }
      },
    })

    await main(
      [
        "node",
        "postbag",
        "--json",
        "sandbox",
        "create",
        "--name",
        "Contact",
        "--origin",
        "https://example.com",
      ],
      harness.deps,
    )

    const printed = JSON.parse(harness.logs[0] ?? "{}") as { sandbox_token: string }
    expect(printed.sandbox_token).toBe(sandboxToken)
  })

  it("reads with only the sandbox capability", async () => {
    const harness = createHarness({
      env: { POSTBAG_SANDBOX_TOKEN: sandboxToken },
      handleFetch: (request) => {
        expect(request.url).toBe(`https://postbag.dev/v1/public/sandboxes/${sandboxId}`)
        expect(request.headers["authorization"]).toBe(`Sandbox ${sandboxToken}`)
        return {
          body: {
            id: sandboxId,
            name: "Contact",
            status: "active",
            submit_url: `https://postbag.dev/s/${sandboxId}`,
            expires_at: "2026-08-24T00:00:00.000Z",
            accepted_count: 1,
            remaining: 4,
            submissions: [],
          },
        }
      },
    })

    await main(["node", "postbag", "--json", "sandbox", "status"], harness.deps)
    expect(harness.requests).toHaveLength(1)
  })

  it("claims with both the API key and sandbox token", async () => {
    const harness = createHarness({
      env: { POSTBAG_API_KEY: "pb_live_test", POSTBAG_SANDBOX_TOKEN: sandboxToken },
      handleFetch: (request) => {
        expect(request.url).toBe(`https://postbag.dev/v1/sandboxes/${sandboxId}/claim`)
        expect(request.headers["authorization"]).toBe("Bearer pb_live_test")
        expect(request.headers["postbag-sandbox-token"]).toBe(sandboxToken)
        return {
          body: {
            claimed: true,
            idempotent: false,
            form: {
              id: sandboxId,
              project_id: "prj_23456789abcd",
              slug: "contact",
              name: "Contact",
              submit_url: `https://postbag.dev/s/${sandboxId}`,
            },
            copied_test_submissions: 1,
            next: [],
          },
        }
      },
    })

    await main(["node", "postbag", "--json", "sandbox", "claim"], harness.deps)
    expect(harness.requests).toHaveLength(1)
  })
})
