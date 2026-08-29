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
    expect(result).toEqual({
      ok: true,
      submissionId: "sb_1",
      status: "received",
      deliveries: undefined,
    })
  })

  it("resolves a bare form id against baseUrl", async () => {
    let capturedUrl = ""
    const fakeFetch: typeof globalThis.fetch = (input) => {
      capturedUrl = input as string
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, submission_id: "sb_2", status: "received" }), {
          status: 200,
        }),
      )
    }

    await submit("fm_abc", {}, { fetch: fakeFetch, baseUrl: "http://localhost:3000/" })

    expect(capturedUrl).toBe("http://localhost:3000/s/fm_abc")
  })

  it("posts FormData without overriding its Content-Type", async () => {
    const formData = new FormData()
    formData.append("email", "a@b.com")
    formData.append("screenshot", new Blob(["image"]), "screen.txt")

    let capturedBody: BodyInit | null | undefined
    let capturedHeaders: HeadersInit | undefined
    const fakeFetch: typeof globalThis.fetch = (_input, init) => {
      capturedBody = init?.body
      capturedHeaders = init?.headers
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, submission_id: "sb_3", status: "received" }), {
          status: 200,
        }),
      )
    }

    await submit("https://x/s/fm_1", formData, { fetch: fakeFetch })

    expect(capturedBody).toBe(formData)
    expect(capturedHeaders).toBeUndefined()
  })

  it("clones FormData before adding _test and returns attachment ids", async () => {
    const formData = new FormData()
    formData.append("email", "a@b.com")
    formData.append("_test", "false")

    let capturedBody: FormData | undefined
    const fakeFetch: typeof globalThis.fetch = (_input, init) => {
      capturedBody = init?.body as FormData
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            submission_id: "sb_4",
            status: "received",
            attachments: [{ id: "fl_1" }, { id: "fl_2" }],
          }),
          { status: 200 },
        ),
      )
    }

    const result = await submit("https://x/s/fm_1", formData, { fetch: fakeFetch, test: true })

    expect(capturedBody).not.toBe(formData)
    expect(capturedBody?.get("email")).toBe("a@b.com")
    expect(capturedBody?.get("_test")).toBe("true")
    expect(formData.get("_test")).toBe("false")
    expect(result.attachmentIds).toEqual(["fl_1", "fl_2"])
  })

  it("throws with the response body on a non-2xx status", async () => {
    const fakeFetch: typeof globalThis.fetch = () =>
      Promise.resolve(new Response("nope", { status: 500 }))

    await expect(submit("https://x/s/fm_1", {}, { fetch: fakeFetch })).rejects.toThrow("500")
  })
})
