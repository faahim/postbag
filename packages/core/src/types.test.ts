import { describe, expect, it } from "vitest"

import {
  DestinationInputSchema,
  FormInputSchema,
  RouteInputSchema,
  StreamSourceInputSchema,
} from "./types.js"

describe("API input schemas", () => {
  it("parses a typed email destination", () => {
    const parsed = DestinationInputSchema.parse({
      type: "email",
      name: "Inbox",
      config: { to: ["owner@example.com"] },
    })

    expect(parsed.type).toBe("email")
  })

  it("rejects a route with zero or two sources", () => {
    expect(RouteInputSchema.safeParse({ destination_id: "ds_x" }).success).toBe(false)
    expect(
      RouteInputSchema.safeParse({ form_id: "fm_x", stream_id: "st_x", destination_id: "ds_x" })
        .success,
    ).toBe(false)
  })

  it("rejects a stream source with zero or two selectors", () => {
    expect(StreamSourceInputSchema.safeParse({ mapping: {} }).success).toBe(false)
    expect(
      StreamSourceInputSchema.safeParse({ form_id: "fm_x", selector: "tag:a", mapping: {} })
        .success,
    ).toBe(false)
  })

  it("applies Form defaults without inventing a name", () => {
    expect(FormInputSchema.parse({})).toMatchObject({
      tags: [],
      schema_mode: "observe",
      status: "active",
    })
  })
})
