import { describe, expect, it } from "vitest"

import { signWebhook, verifyWebhookSignature } from "./signing.js"

describe("webhook signing", () => {
  it("verifies a signed body inside the tolerance window", async () => {
    const signature = await signWebhook("secret", 1_724_200_000, '{"ok":true}')

    await expect(
      verifyWebhookSignature("secret", signature, '{"ok":true}', {
        now: 1_724_200_120,
        toleranceSeconds: 300,
      }),
    ).resolves.toBe(true)
  })

  it("rejects tampering and stale timestamps", async () => {
    const signature = await signWebhook("secret", 1_724_200_000, "body")

    await expect(
      verifyWebhookSignature("secret", signature, "changed", { now: 1_724_200_100 }),
    ).resolves.toBe(false)
    await expect(
      verifyWebhookSignature("secret", signature, "body", { now: 1_724_200_400 }),
    ).resolves.toBe(false)
  })

  it("rejects malformed headers without attempting verification", async () => {
    await expect(
      verifyWebhookSignature("secret", "v1=not-a-signature", "body", {
        now: 1_724_200_100,
      }),
    ).resolves.toBe(false)
  })
})
