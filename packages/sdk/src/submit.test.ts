import { describe, expect, it } from "vitest"

import { submit } from "./submit.js"

describe("submit", () => {
  it("posts JSON to a full submit URL and parses the receipt", async () => {
    let capturedUrl = ""
    let capturedBody = ""
    const fakeFetch: typeof globalThis.fetch = (input, init) => {
      capturedUrl = input as string
      capturedBody = (init?.body ?? "") as string
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, submission_id: "sb_1", status: "received" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
    }

    const result = await submit(
      "https://api.postbag.dev/s/fm_abc",
      { email: "a@b.com" },
      { fetch: fakeFetch, test: true },
    )

    expect(capturedUrl).toBe("https://api.postbag.dev/s/fm_abc")
    expect(JSON.parse(capturedBody)).toMatchObject({ email: "a@b.com", _test: true })
    expect(result).toEqual({ ok: true, submissionId: "sb_1", status: "received", deliveries: undefined })
  })

  it("resolves a bare form id against baseUrl", async () => {
    let capturedUrl = ""
    const fakeFetch: typeof globalThis.fetch = (input) => {
      capturedUrl = input as string
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, submission_id: "sb_2", status: "received" }), { status: 200 }),
      )
    }

    await submit("fm_abc", {}, { fetch: fakeFetch, baseUrl: "http://localhost:3000/" })

    expect(capturedUrl).toBe("http://localhost:3000/s/fm_abc")
  })

  it("throws with the response body on a non-2xx status", async () => {
    const fakeFetch: typeof globalThis.fetch = () => Promise.resolve(new Response("nope", { status: 500 }))

    await expect(submit("https://x/s/fm_1", {}, { fetch: fakeFetch })).rejects.toThrow("500")
  })
})
