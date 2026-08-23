import { describe, expect, it } from "vitest"

import {
  decryptSandboxToken,
  encryptSandboxToken,
  isCanonicalUuidV4,
  jsonDepth,
  newSandboxToken,
  sandboxIdFromToken,
  sourceAddressGroup,
} from "./anonymousSandbox.js"

describe("anonymous sandbox capability helpers", () => {
  it("round-trips an encrypted Form-compatible capability", () => {
    const token = newSandboxToken("fm_23456789abcd")
    expect(sandboxIdFromToken(token)).toBe("fm_23456789abcd")
    expect(
      decryptSandboxToken(
        "a sufficiently long test secret",
        encryptSandboxToken("a sufficiently long test secret", token),
      ),
    ).toBe(token)
  })

  it("accepts only canonical lowercase UUIDv4 idempotency keys", () => {
    expect(isCanonicalUuidV4("123e4567-e89b-42d3-a456-426614174000")).toBe(true)
    expect(isCanonicalUuidV4("123E4567-E89B-42D3-A456-426614174000")).toBe(false)
    expect(isCanonicalUuidV4("123e4567-e89b-12d3-a456-426614174000")).toBe(false)
  })

  it("groups IPv6 sources by /64 and leaves IPv4 addresses distinct", () => {
    expect(sourceAddressGroup("2001:db8:abcd:12::1")).toBe("2001:0db8:abcd:0012::/64")
    expect(sourceAddressGroup("2001:db8:abcd:12:ffff::9")).toBe("2001:0db8:abcd:0012::/64")
    expect(sourceAddressGroup("192.0.2.4")).toBe("192.0.2.4")
  })

  it("measures object and array nesting", () => {
    expect(jsonDepth({ one: { two: { three: "ok" } } })).toBe(3)
    expect(jsonDepth({ one: { two: { three: { four: "too deep" } } } })).toBe(4)
  })
})
