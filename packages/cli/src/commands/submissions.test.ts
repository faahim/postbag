import { createClient } from "@postbag/sdk"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Ctx } from "../lib/context.js"
import { createHarness } from "../lib/testHarness.js"
import { tail } from "./submissions.js"

function buildCtx(harness: ReturnType<typeof createHarness>): Ctx {
  return {
    client: createClient({ baseUrl: "https://postbag.dev", apiKey: "pb_live_test", fetch: harness.deps.fetch }),
    json: true,
    apiUrl: "https://postbag.dev",
    apiKey: "pb_live_test",
    io: harness.deps.io,
    deps: harness.deps,
  }
}

describe("submissions tail", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("prints only submission ids not seen on a previous poll, oldest-first", async () => {
    const pages = [
      { data: [{ id: "sb_2", form_id: "fm_1" }, { id: "sb_1", form_id: "fm_1" }], next_cursor: null },
      { data: [{ id: "sb_3", form_id: "fm_1" }, { id: "sb_2", form_id: "fm_1" }, { id: "sb_1", form_id: "fm_1" }], next_cursor: null },
    ]
    let call = 0
    const harness = createHarness({
      handleFetch: () => {
        const page = pages[Math.min(call, pages.length - 1)]
        call += 1
        return { status: 200, body: page }
      },
    })
    const ctx = buildCtx(harness)

    const run = tail(ctx, "fm_1", 1000, { ticks: 2 })
    await vi.advanceTimersByTimeAsync(1000)
    await run

    const printedIds = harness.logs.map((line) => (JSON.parse(line) as { id: string }).id)
    expect(printedIds).toEqual(["sb_1", "sb_2", "sb_3"])
    expect(call).toBe(2)
  })

  it("stops when the abort signal fires, without printing anything after", async () => {
    const harness = createHarness({
      handleFetch: () => ({ status: 200, body: { data: [{ id: "sb_1", form_id: "fm_1" }], next_cursor: null } }),
    })
    const ctx = buildCtx(harness)
    const controller = new AbortController()

    const run = tail(ctx, "fm_1", 1000, { signal: controller.signal })
    await vi.advanceTimersByTimeAsync(0) // let the first fetch/print resolve
    controller.abort()
    await run

    expect(harness.logs).toHaveLength(1)
  })
})
