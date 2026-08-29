import type { DeliveryResult } from "@postbag/core"
import type { ZodType } from "zod"

export type Payload = Readonly<Record<string, unknown>>

export type NamedRef = { readonly id: string; readonly name: string; readonly slug: string }

export type AttachmentLink = {
  readonly id: string
  readonly field_name: string
  readonly filename: string
  readonly content_type: string
  readonly size_bytes: number
  readonly sha256: string
  readonly download_url: string
  readonly expires_at: string
}

export type DeliveryContext = {
  readonly deliveryId: string
  readonly eventType: string
  readonly schemaVersion: number | null
  readonly form: NamedRef | null
  readonly project: NamedRef | null
  readonly stream: NamedRef | null
  readonly submission: { readonly id: string; readonly received_at: string } | null
  readonly extras: Payload
  readonly meta: Payload
  readonly attachments: readonly AttachmentLink[]
}

/**
 * The template context every destination renders subjects/messages against (job D 1b):
 * `form`, `project`, `stream`, `submission`, `data`, `extras`, `meta` — never just the
 * form's slug, which is what produced the "New submission: overnight-smoke-test" bug.
 */
export function templateContext(ctx: DeliveryContext, payload: Payload): Payload {
  return {
    form: ctx.form,
    project: ctx.project,
    stream: ctx.stream,
    submission: ctx.submission,
    data: payload,
    extras: ctx.extras,
    meta: ctx.meta,
    attachments: ctx.attachments,
  }
}

export type DigestSubmission = {
  readonly id: string
  readonly received_at: string
  readonly data: Payload
  readonly attachments: readonly AttachmentLink[]
}

export type DigestContext = {
  readonly digestId: string
  readonly routeId: string
  readonly periodKey: string
  readonly form: NamedRef | null
  readonly project: NamedRef | null
  readonly stream: NamedRef | null
}

/** ARCHITECTURE.md "Destination adapters" — one file per type implementing this. */
export type DestinationAdapter<Config> = {
  readonly type: string
  readonly configSchema: ZodType<Config>
  redactConfig(config: Config): Partial<Config>
  test(config: Config, sample: Payload): Promise<DeliveryResult>
  deliver(config: Config, payload: Payload, ctx: DeliveryContext): Promise<DeliveryResult>
  /** Job D §3: one payload per destination for a closed digest period — never one send
   * per submission. Email gets a table, Telegram a compact list, webhooks `digest.ready`. */
  deliverDigest(
    config: Config,
    submissions: readonly DigestSubmission[],
    ctx: DigestContext,
  ): Promise<DeliveryResult>
}

/** Type-erased view used by the registry so it can hold adapters of different configs. */
export type AnyDestinationAdapter = {
  readonly type: string
  readonly configSchema: ZodType
  redactConfig(config: unknown): unknown
  test(config: unknown, sample: Payload): Promise<DeliveryResult>
  deliver(config: unknown, payload: Payload, ctx: DeliveryContext): Promise<DeliveryResult>
  deliverDigest(
    config: unknown,
    submissions: readonly DigestSubmission[],
    ctx: DigestContext,
  ): Promise<DeliveryResult>
}

export function eraseAdapter<Config>(adapter: DestinationAdapter<Config>): AnyDestinationAdapter {
  return {
    type: adapter.type,
    configSchema: adapter.configSchema,
    redactConfig: (config) => adapter.redactConfig(adapter.configSchema.parse(config)),
    test: (config, sample) => adapter.test(adapter.configSchema.parse(config), sample),
    deliver: (config, payload, ctx) =>
      adapter.deliver(adapter.configSchema.parse(config), payload, ctx),
    deliverDigest: (config, submissions, ctx) =>
      adapter.deliverDigest(adapter.configSchema.parse(config), submissions, ctx),
  }
}
