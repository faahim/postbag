import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock("@/lib/api", () => ({
  api: { GET: mocks.get },
  unwrap: <T>(result: { data: T }): T => result.data,
}))

import { fetchAllStreams, type Stream } from "./streams"

const stream = (id: string): Stream => ({
  id,
  name: id,
  slug: id,
  current_schema_version: null,
  created_at: "2026-08-27T00:00:00.000Z",
  counts: { sources: 0, routes: 0, submissions_30d: 0 },
})

describe("fetchAllStreams", () => {
  beforeEach(() => {
    mocks.get.mockReset()
  })

  it("follows the cursor so Streams after the first 100 are available", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => stream(`st_${index.toString()}`))
    mocks.get.mockResolvedValueOnce({ data: { data: firstPage, next_cursor: "next-page" } })
    mocks.get.mockResolvedValueOnce({ data: { data: [stream("st_100")], next_cursor: null } })

    await expect(fetchAllStreams()).resolves.toHaveLength(101)
    expect(mocks.get).toHaveBeenNthCalledWith(1, "/v1/streams", { params: { query: { limit: 100 } } })
    expect(mocks.get).toHaveBeenNthCalledWith(2, "/v1/streams", { params: { query: { cursor: "next-page", limit: 100 } } })
  })

  it("fails instead of looping forever when the API repeats a cursor", async () => {
    mocks.get.mockResolvedValue({ data: { data: [], next_cursor: "stuck" } })

    await expect(fetchAllStreams()).rejects.toThrow("Streams pagination repeated a cursor.")
  })
})
