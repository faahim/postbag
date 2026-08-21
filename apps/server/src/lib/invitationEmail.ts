import { Resend } from "resend"

// Job L §2: invitation email, sent directly by POST /v1/invitations (not through Better
// Auth's organization plugin — its `createInvitation`/`sendInvitationEmail` require a
// session, which an API-key-driven `postbag invitations create` doesn't have; see the
// route for the fuller rationale). Same Resend client + MAIL_FROM convention as
// otpEmail.ts and destinations/email.ts.

export type InvitationEmailConfig = {
  readonly resendApiKey: string
  readonly mailFrom: string
}

export type InvitationEmailInput = {
  readonly to: string
  readonly inviterName: string
  readonly organizationName: string
  readonly role: string
  readonly acceptUrl: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function textBody(input: InvitationEmailInput): string {
  return [
    `${input.inviterName} invited you to join ${input.organizationName} on Postbag as ${input.role}.`,
    "",
    `Accept the invitation: ${input.acceptUrl}`,
    "",
    "If you weren't expecting this, you can safely ignore this email.",
  ].join("\n")
}

function htmlBody(input: InvitationEmailInput): string {
  return (
    `<div style="font-family:system-ui,sans-serif"><h2 style="margin:0 0 12px">You're invited</h2>` +
    `<p style="margin:0 0 16px;color:#333">` +
    `<strong>${escapeHtml(input.inviterName)}</strong> invited you to join ` +
    `<strong>${escapeHtml(input.organizationName)}</strong> on Postbag as <strong>${escapeHtml(input.role)}</strong>.</p>` +
    `<p style="margin:0 0 20px"><a href="${escapeHtml(input.acceptUrl)}" style="display:inline-block;padding:10px 18px;` +
    `background:#111;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Accept invitation</a></p>` +
    `<p style="color:#666;margin:0;font-size:13px">If you weren't expecting this, you can safely ignore this email.</p></div>`
  )
}

export type InvitationEmailSender = (input: InvitationEmailInput) => Promise<void>

/** Mirrors `createOtpEmailSender`: `undefined` when no Resend key is configured
 * (self-host parity — the route still creates the invitation row, it just can't email it;
 * the dashboard's "resend" action lets an operator retry once email is configured). */
export function createInvitationEmailSender(config: InvitationEmailConfig | undefined): InvitationEmailSender | undefined {
  if (config === undefined) return undefined
  const client = new Resend(config.resendApiKey)
  return async (input) => {
    const result = await client.emails.send({
      from: config.mailFrom,
      to: [input.to],
      subject: `${input.inviterName} invited you to ${input.organizationName} on Postbag`,
      text: textBody(input),
      html: htmlBody(input),
    })
    if (result.error !== null) throw new Error(result.error.message)
  }
}
