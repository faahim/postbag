/**
 * Email → Postbag.
 *
 * A Cloudflare Email Routing Worker that turns every inbound email into a Postbag
 * Submission. Point an Email Routing rule at this Worker and the mailbox becomes a
 * Form: durable, queryable over `/v1`, and routable to any Destination.
 *
 * Guarantees, in order:
 *   1. The email is never dropped silently. If Postbag does not acknowledge the
 *      Submission and no forwarding copy was made, the message is rejected so the
 *      sending server retries or bounces.
 *   2. Attachments are best effort. If Postbag refuses the upload (plan limits,
 *      size), the email is re-posted without files and flagged `attachments_dropped`.
 *   3. Re-deliveries are de-duplicated by Message-ID via `Idempotency-Key`.
 */
import PostalMime, { type Email } from "postal-mime"

export interface Env {
  /** The Form's submit URL, e.g. https://postbag.dev/s/fm_xxxxxxxxxxxx */
  POSTBAG_SUBMIT_URL: string
  /** Optional: also forward every email to this verified address (safety net). */
  FORWARD_TO?: string
  /** Optional: cap on the text/html body kept in the Submission (bytes). Default 100000. */
  BODY_CAP_BYTES?: string
}

const DEFAULT_BODY_CAP = 100_000
const HEADERS_TO_KEEP = ["message-id", "in-reply-to", "references", "date", "list-id", "x-priority"] as const

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    if (!env.POSTBAG_SUBMIT_URL) {
      throw new Error("POSTBAG_SUBMIT_URL is not set")
    }

    // `message.raw` is single-use: buffer once, then parse and (optionally) forward.
    const raw = await new Response(message.raw).arrayBuffer()
    const mail = await PostalMime.parse(raw)

    let forwarded = false
    if (env.FORWARD_TO) {
      try {
        await message.forward(env.FORWARD_TO)
        forwarded = true
      } catch (error) {
        console.error("forward failed", { to: env.FORWARD_TO, error: String(error) })
      }
    }

    const cap = Number.parseInt(env.BODY_CAP_BYTES ?? "", 10) || DEFAULT_BODY_CAP
    const fields = toFields(message, mail, raw.byteLength, cap)
    const idempotencyKey = mail.messageId?.trim() || `raw:${await sha256Hex(raw)}`

    const result = await submit(env.POSTBAG_SUBMIT_URL, fields, mail.attachments, idempotencyKey)

    if (result.ok) {
      console.log("submitted", { submission_id: result.submissionId, from: message.from, attachments: result.attachmentsSent })
      return
    }

    console.error("postbag submit failed", { status: result.status, body: result.body, from: message.from })
    if (!forwarded) {
      // No copy exists anywhere. Tell the sending server so it retries or bounces.
      message.setReject(`Mailbox temporarily unavailable (upstream ${String(result.status)})`)
    }
  },
} satisfies ExportedHandler<Env>

// ---------------------------------------------------------------------------

type Fields = Record<string, string | number | boolean | string[] | Record<string, string> | Record<string, unknown>[]>

function toFields(message: ForwardableEmailMessage, mail: Email, rawSize: number, cap: number): Fields {
  const text = truncate(mail.text ?? "", cap)
  const html = truncate(mail.html ?? "", cap)
  const headers: Record<string, string> = {}
  for (const name of HEADERS_TO_KEEP) {
    const value = message.headers.get(name)
    if (value) headers[name] = value
  }

  return {
    // Envelope addresses are what the SMTP server saw; header addresses can be spoofed.
    from: message.from,
    to: message.to,
    from_name: mail.from?.name ?? "",
    from_address: mail.from?.address ?? message.from,
    reply_to: (mail.replyTo ?? []).map((a) => a.address ?? "").filter(Boolean),
    cc: (mail.cc ?? []).map((a) => a.address ?? "").filter(Boolean),
    subject: mail.subject ?? "",
    text: text.value,
    html: html.value,
    text_truncated: text.truncated,
    html_truncated: html.truncated,
    message_id: mail.messageId ?? "",
    in_reply_to: mail.inReplyTo ?? "",
    date: mail.date ?? "",
    raw_size: rawSize,
    headers,
    attachments: mail.attachments.map((a) => ({
      filename: a.filename ?? "",
      mime_type: a.mimeType,
      size: byteLength(a.content),
      content_id: a.contentId ?? "",
    })),
  }
}

type SubmitResult =
  | { ok: true; status: number; submissionId: string; attachmentsSent: number }
  | { ok: false; status: number; body: string; attachmentsSent: number }

async function submit(
  url: string,
  fields: Fields,
  attachments: Email["attachments"],
  idempotencyKey: string,
): Promise<SubmitResult> {
  // Always multipart: one field shape whether or not files are present, and a body
  // ceiling in MiB rather than the 256 KiB JSON limit. Postbag stores every part as a
  // string, so list/object values are JSON-encoded strings.
  const headers = { accept: "application/json", "idempotency-key": idempotencyKey }

  if (attachments.length > 0) {
    const first = await post(url, headers, toForm(fields, attachments))
    if (first.ok) return { ...first, attachmentsSent: attachments.length }
    console.warn("multipart with files rejected, retrying without attachments", { status: first.status, body: first.body })
    fields["attachments_dropped"] = true
    fields["attachments_dropped_reason"] = `${String(first.status)} ${first.body.slice(0, 500)}`
  }

  const second = await post(url, headers, toForm(fields, []))
  return { ...second, attachmentsSent: 0 }
}

function toForm(fields: Fields, attachments: Email["attachments"]): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, typeof value === "string" ? value : JSON.stringify(value))
  }
  attachments.forEach((a, i) => {
    const name = a.filename ?? `attachment-${String(i + 1)}`
    form.append(`file_${String(i + 1)}`, new File([toBlobPart(a.content)], name, { type: a.mimeType }), name)
  })
  return form
}

type PostResult = { ok: true; status: number; submissionId: string } | { ok: false; status: number; body: string }

/**
 * A 2xx is not enough: a misconfigured URL or an intermediary can answer 200 with
 * anything. Only the Postbag receipt (`ok: true` plus a `submission_id`) counts as
 * durable receipt; everything else is a failure the caller must not swallow.
 */
async function post(url: string, headers: Record<string, string>, body: FormData): Promise<PostResult> {
  let res: Response
  try {
    res = await fetch(url, { method: "POST", headers, body })
  } catch (error) {
    return { ok: false, status: 0, body: `fetch failed: ${String(error)}` }
  }
  const text = await res.text()
  if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 1000) }
  const receipt = parseReceipt(text)
  if (receipt === null) {
    return { ok: false, status: res.status, body: `no Postbag receipt in response: ${text.slice(0, 300)}` }
  }
  return { ok: true, status: res.status, submissionId: receipt }
}

function parseReceipt(text: string): string | null {
  try {
    const json: unknown = JSON.parse(text)
    if (typeof json !== "object" || json === null) return null
    const r = json as { ok?: unknown; submission_id?: unknown }
    return r.ok === true && typeof r.submission_id === "string" && r.submission_id !== "" ? r.submission_id : null
  } catch {
    return null
  }
}

/** Cap at `cap` UTF-8 bytes without splitting a multi-byte sequence. */
function truncate(value: string, cap: number): { value: string; truncated: boolean } {
  const bytes = new TextEncoder().encode(value)
  if (bytes.byteLength <= cap) return { value, truncated: false }
  let end = cap
  while (end > 0 && (bytes[end] ?? 0) >> 6 === 0b10) end-- // back up over continuation bytes
  return { value: new TextDecoder().decode(bytes.subarray(0, end)), truncated: true }
}

function byteLength(content: ArrayBuffer | Uint8Array | string): number {
  if (typeof content === "string") return new TextEncoder().encode(content).byteLength
  return content.byteLength
}

function toBlobPart(content: ArrayBuffer | Uint8Array | string): ArrayBuffer | Uint8Array | string {
  if (typeof content === "string") return content
  if (content instanceof Uint8Array) return new Uint8Array(content) // copy: detach-safe
  return content
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}
