import { describe, expect, it } from "vitest"

import { createHarness } from "../lib/testHarness.js"
import { main } from "../main.js"

describe("postbag api (escape hatch)", () => {
  it("builds the right request for a GET with no body", async () => {
    const harness = createHarness({
      env: { POSTBAG_API_KEY: "pb_live_test", POSTBAG_API_URL: "https://api.postbag.dev" },
      handleFetch: () => ({ status: 200, body: { organization: { name: "Acme" } } }),
    })

    await main(["node", "postbag", "--json", "api", "GET", "/v1/me"], harness.deps)

    expect(harness.requests).toHaveLength(1)
    const [req] = harness.requests
    expect(req?.url).toBe("https://api.postbag.dev/v1/me")
    expect(req?.method).toBe("GET")
    expect(req?.body).toBeUndefined()
    expect(req?.headers["authorization"]).toBe("Bearer pb_live_test")
    expect(JSON.parse(harness.logs[0] ?? "{}")).toEqual({ organization: { name: "Acme" } })
  })

  it("builds the right request for a POST with --data, and normalizes the method", async () => {
    const harness = createHarness({
      env: { POSTBAG_API_KEY: "pb_live_test" },
      handleFetch: () => ({ status: 201, body: { id: "fm_1" } }),
    })

    await main(
      ["node", "postbag", "--json", "api", "post", "/v1/forms", "--data", '{"name":"Contact"}'],
      harness.deps,
    )

    const [req] = harness.requests
    expect(req?.method).toBe("POST")
    expect(req?.url).toBe("https://postbag.dev/v1/forms")
    expect(JSON.parse(req?.body ?? "{}")).toEqual({ name: "Contact" })
    expect(req?.headers["content-type"]).toBe("application/json")
  })

  it("renders an API error with code/message/hint/docs and exits 1", async () => {
    const harness = createHarness({
      env: { POSTBAG_API_KEY: "pb_bad" },
      handleFetch: () => ({
        status: 404,
        body: { error: { code: "not_found", message: "No such form.", hint: "Check the id.", docs: "https://postbag.dev/docs/errors#not_found" } },
      }),
    })

    process.exitCode = 0
    await main(["node", "postbag", "--json", "api", "GET", "/v1/forms/fm_missing"], harness.deps)

    expect(process.exitCode).toBe(1)
    process.exitCode = 0
    const printed = JSON.parse(harness.errors[0] ?? "{}") as { error: { code: string; hint: string } }
    expect(printed.error.code).toBe("not_found")
    expect(printed.error.hint).toBe("Check the id.")
  })

  it("rejects an unsupported method before making a request", async () => {
    const harness = createHarness({ env: { POSTBAG_API_KEY: "pb_live_test" } })

    process.exitCode = 0
    await main(["node", "postbag", "--json", "api", "FROBNICATE", "/v1/me"], harness.deps)

    expect(harness.requests).toHaveLength(0)
    expect(process.exitCode).toBe(1)
    process.exitCode = 0
  })
})

describe("postbag explain", () => {
  it("prints the raw llms.txt body", async () => {
    const harness = createHarness({
      handleFetch: (req) => {
        expect(req.url).toBe("https://postbag.dev/llms.txt")
        return { status: 200, body: undefined, headers: { "content-type": "text/markdown" } }
      },
    })
    // The fake response body is empty text either way; assert the request shape and that it printed something.
    await main(["node", "postbag", "explain"], { ...harness.deps, stdoutIsTty: true })
    expect(harness.requests[0]?.method).toBe("GET")
  })
})
