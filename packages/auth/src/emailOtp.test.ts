import { describe, expect, it, vi } from "vitest"

import { buildSendVerificationOTP, EmailOtpNotConfiguredError, type SendEmailOTPInput } from "./auth.js"

// Job H 1a: unit-tests the wiring in isolation from Better Auth's endpoint machinery,
// which awaits `sendVerificationOTP` but swallows any rejection (see the comment on
// `EmailOtpNotConfiguredError` in auth.ts) — so this is the only place the throwing
// behaviour is directly observable.
describe("buildSendVerificationOTP", () => {
  const input: SendEmailOTPInput = { email: "agent@example.test", otp: "123456", type: "sign-in" }

  it("throws EmailOtpNotConfiguredError when no sendEmailOTP option was supplied", async () => {
    const send = buildSendVerificationOTP({})
    await expect(send(input)).rejects.toBeInstanceOf(EmailOtpNotConfiguredError)
  })

  it("calls the configured sendEmailOTP with the exact input it received", async () => {
    const sendEmailOTP = vi.fn().mockResolvedValue(undefined)
    const send = buildSendVerificationOTP({ sendEmailOTP })
    await send(input)
    expect(sendEmailOTP).toHaveBeenCalledTimes(1)
    expect(sendEmailOTP).toHaveBeenCalledWith(input)
  })

  it("propagates a rejection from the configured sendEmailOTP", async () => {
    const sendEmailOTP = vi.fn().mockRejectedValue(new Error("resend down"))
    const send = buildSendVerificationOTP({ sendEmailOTP })
    await expect(send(input)).rejects.toThrow("resend down")
  })
})
