import type { SendEmailOTPInput } from "@postbag/auth"
import { Resend } from "resend"

// Job H 1a/1b: the caller-supplied half of Better Auth's `emailOTP` plugin
// (`CreateAuthOptions.sendEmailOTP` in packages/auth). Kept in apps/server, same reason
// `onUserCreated`/`socialProviders` are: packages/auth stays a thin, I/O-free auth config.
// Reuses the same Resend client + MAIL_FROM convention as apps/server/src/destinations/email.ts.

export type OtpEmailConfig = {
  readonly resendApiKey: string
  readonly mailFrom: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function textBody(otp: string): string {
  return [
    `Your Postbag code: ${otp}`,
    "",
    "This code expires in 10 minutes.",
    "",
    "An AI agent or the Postbag CLI asked for this on your behalf; if you did not, ignore this email.",
  ].join("\n")
}

function htmlBody(otp: string): string {
  return (
    `<div style="font-family:system-ui,sans-serif"><h2 style="margin:0 0 12px">Your Postbag code</h2>` +
    `<p style="font-size:32px;font-weight:600;letter-spacing:0.1em;margin:0 0 16px">${escapeHtml(otp)}</p>` +
    `<p style="color:#666;margin:0 0 8px">This code expires in 10 minutes.</p>` +
    `<p style="color:#666;margin:0">An AI agent or the Postbag CLI asked for this on your behalf; if you did not, ignore this email.</p></div>`
  )
}

type OtpSender = (input: SendEmailOTPInput) => Promise<void>

/**
 * Better Auth runs `sendVerificationOTP` through `runInBackgroundOrAwait`, which logs and
 * swallows a rejection — so a failed send would otherwise look like `200 ok` to the caller
 * (seen in production: a transient fetch failure seconds after container boot). The tracked
 * sender records the failure per normalised email; the route takes it right after the
 * Better Auth call and answers `502 email_send_failed` instead of lying.
 */
export class OtpSendFailures {
  private readonly failures = new Map<string, string>()

  record(email: string, reason: string): void {
    this.failures.set(email.trim().toLowerCase(), reason)
  }

  /** Returns and clears the recorded failure for this email, if any. */
  take(email: string): string | undefined {
    const key = email.trim().toLowerCase()
    const reason = this.failures.get(key)
    this.failures.delete(key)
    return reason
  }
}

export const otpSendFailures = new OtpSendFailures()

export function withFailureTracking(sender: OtpSender, tracker: OtpSendFailures = otpSendFailures): OtpSender {
  return async (input) => {
    try {
      await sender(input)
    } catch (error) {
      tracker.record(input.email, error instanceof Error ? error.message : String(error))
      throw error
    }
  }
}

const RETRY_DELAY_MS = 400

/** Builds the `sendEmailOTP` callback `createAuth()` needs, or `undefined` when no Resend
 * key is configured (self-host parity — the caller then returns 501 without ever reaching
 * Better Auth; see the comment on `EmailOtpNotConfiguredError` in packages/auth).
 * One retry absorbs the transient network errors Resend's SDK reports as
 * "Unable to fetch data"; a second failure is thrown (and tracked, see above). */
export function createOtpEmailSender(config: OtpEmailConfig | undefined): OtpSender | undefined {
  if (config === undefined) return undefined
  const client = new Resend(config.resendApiKey)
  const attempt = async (email: string, otp: string): Promise<string | undefined> => {
    try {
      const result = await client.emails.send({
        from: config.mailFrom,
        to: [email],
        subject: `Your Postbag code: ${otp}`,
        text: textBody(otp),
        html: htmlBody(otp),
      })
      return result.error === null ? undefined : result.error.message
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }
  return async ({ email, otp }) => {
    const first = await attempt(email, otp)
    if (first === undefined) return
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    const second = await attempt(email, otp)
    if (second !== undefined) throw new Error(second)
  }
}
