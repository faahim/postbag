import { describe, expect, it, vi } from "vitest"

// The drawer imports the authenticated API client, which is browser-only. This unit
// test only exercises its presentational size helper, so provide the same minimal
// location surface that the client needs before loading the component module.
vi.stubGlobal("window", { location: { origin: "http://localhost" } })

const { formatAttachmentSize } = await import("./submission-drawer")

describe("formatAttachmentSize", () => {
  it("uses compact binary units without losing useful precision", () => {
    expect(formatAttachmentSize(999)).toBe("999 B")
    expect(formatAttachmentSize(1536)).toBe("1.5 KiB")
    expect(formatAttachmentSize(2 * 1024 * 1024)).toBe("2 MiB")
  })
})
