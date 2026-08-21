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

/** Builds the `sendEmailOTP` callback `createAuth()` needs, or `undefined` when no Resend
 * key is configured (self-host parity — the caller then returns 501 without ever reaching
 * Better Auth; see the comment on `EmailOtpNotConfiguredError` in packages/auth). */
export function createOtpEmailSender(
  config: OtpEmailConfig | undefined,
): ((input: SendEmailOTPInput) => Promise<void>) | undefined {
  if (config === undefined) return undefined
  const client = new Resend(config.resendApiKey)
  return async ({ email, otp }) => {
    const result = await client.emails.send({
      from: config.mailFrom,
      to: [email],
      subject: `Your Postbag code: ${otp}`,
      text: textBody(otp),
      html: htmlBody(otp),
    })
    if (result.error !== null) throw new Error(result.error.message)
  }
}
