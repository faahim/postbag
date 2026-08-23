import { describe, expect, it } from "vitest"

import { decideCors } from "./cors.js"

describe("decideCors", () => {
  it("allows the browser origin when the configured URL has a trailing slash", () => {
    // Given: an agent saved the site's root URL with its common trailing slash.
    const allowedOrigins = ["https://example.com/"]

    // When: a browser submits its canonical Origin header.
    const decision = decideCors("https://example.com", allowedOrigins)

    // Then: Postbag accepts and echoes the browser origin.
    expect(decision).toEqual({ allowOrigin: "https://example.com" })
  })

  it("compares canonical origins instead of URL paths, host case, or default ports", () => {
    // Given: configuration values that all identify the same HTTPS origin.
    const allowedOrigins = ["HTTPS://EXAMPLE.COM:443/contact?from=agent#form"]

    // When: the browser sends the serialized origin.
    const decision = decideCors("https://example.com", allowedOrigins)

    // Then: the equivalent origin is accepted.
    expect(decision).toEqual({ allowOrigin: "https://example.com" })
  })

  it("keeps non-default ports as distinct origins", () => {
    // Given: a site explicitly configured on a non-default port.
    const allowedOrigins = ["https://example.com:8443/"]

    // When: a browser submits from the default HTTPS port.
    const decision = decideCors("https://example.com", allowedOrigins)

    // Then: the different origin is rejected.
    expect(decision).toEqual({ allowOrigin: null })
  })
})
