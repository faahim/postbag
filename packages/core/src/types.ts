import { z } from "zod"

import type { Mapping } from "./mapping.js"
import type { DriftKind, JsonSchema, UiWidget } from "./schema.js"

// allow: SIZE_OK — OpenAPI component types and matching Zod inputs are one contract surface.
export type Scope = "manage" | "read" | "submit"
export type Plan = "free" | "pro" | "team" | "selfhost"
export type Timestamp = string
export type Id = string
export type Slug = string
export type Next = readonly {
  readonly why?: string
  readonly method?: string
  readonly path?: string
  readonly body?: Readonly<Record<string, unknown>>
}[]

export type ErrorEnvelope = {
  readonly error: {
    readonly code: string
    readonly message: string
    readonly hint?: string
    readonly docs?: string
    readonly details?: Readonly<Record<string, unknown>>
  }
}

export type Organization = {
  readonly id: Id
  readonly slug: Slug
  readonly name: string
  readonly plan: Plan
  readonly timezone: string
}
export type PlanLimits = {
  readonly forms: number
  readonly submissions_per_month: number
  readonly destinations: number
  readonly retention_days: number
  readonly used: { readonly forms: number; readonly submissions_this_month: number }
}
export type User = { readonly id: Id; readonly name: string; readonly email: string }
export type Membership = {
  readonly id: Id
  readonly organization_id: Id
  readonly user_id: Id
  readonly role: "owner" | "admin" | "member"
}
export type ApiKey = {
  readonly id: Id
  readonly organization_id: Id
  readonly prefix: string
  readonly scopes: readonly Scope[]
}
export type OrganizationSettings = {
  readonly organization_id: Id
  readonly plan: Plan
  readonly timezone: string
  readonly limits: Omit<PlanLimits, "used">
}

export type Project = {
  readonly id: Id
  readonly slug: Slug
  readonly name: string
  readonly tags: readonly string[]
  readonly created_at: Timestamp
}
export type ProjectList = { readonly data: readonly Project[]; readonly next_cursor: string | null }

export type SchemaMode = "observe" | "enforce" | "managed"
export type FormStatus = "active" | "paused"
export type FormSettings = {
  readonly allowed_origins?: readonly string[]
  readonly redirect_url?: string | null
  readonly honeypot_field?: string
  readonly turnstile?: { readonly secret?: string; readonly enabled?: boolean }
  readonly rate_limit?: { readonly per_minute?: number; readonly burst?: number }
  readonly reply_to_field?: string | null
}
export type Form = {
  readonly id: Id
  readonly project_id: Id
  readonly slug: Slug
  readonly name: string
  readonly tags: readonly string[]
  readonly status: FormStatus
  readonly schema_mode: SchemaMode
  readonly current_schema_version: number | null
  readonly settings: FormSettings
  readonly submit_url: string
  readonly streams: readonly {
    readonly id: Id
    readonly slug: string
    readonly mapping_status: "valid" | "incomplete"
  }[]
  readonly counts: { readonly submissions: number; readonly last_submission_at: Timestamp | null }
  readonly created_at: Timestamp
}
export type Embed = {
  readonly html?: string
  readonly fetch?: string
  readonly react?: string
  readonly astro?: string
  readonly nextjs_action?: string
}
export type Verify = { readonly curl?: string; readonly then?: string }
export type FormCreated = Form & {
  readonly embed?: Embed
  readonly verify?: Verify
  readonly next?: Next
}
export type FormList = { readonly data: readonly Form[]; readonly next_cursor: string | null }

export type FieldUiHint = {
  readonly label?: string
  readonly placeholder?: string
  readonly help?: string
  readonly order?: number
  readonly widget?: UiWidget
  readonly options?: readonly { readonly value?: string; readonly label?: string }[]
}
export type UiHints = Readonly<Record<string, FieldUiHint>>
export type SchemaVersion = {
  readonly json_schema: JsonSchema
  readonly ui?: UiHints
  readonly changelog?: string
  readonly version?: number
  readonly inferred?: boolean
  readonly created_at?: Timestamp
  readonly created_by?: string
}
export type FormSchema = SchemaVersion & {
  readonly id: Id
  readonly organization_id: Id
  readonly form_id: Id
  readonly version: number
}
export type StreamSchema = SchemaVersion & {
  readonly id: Id
  readonly organization_id: Id
  readonly stream_id: Id
  readonly version: number
}

export type SubmissionStatus = "received" | "quarantined" | "spam"
export type QuarantineReason =
  "schema_violation" | "rate_limited" | "origin_rejected" | "turnstile_failed" | "over_quota"
export type Submission = {
  readonly id: Id
  readonly form_id: Id
  readonly status: SubmissionStatus
  readonly quarantine_reason: QuarantineReason | null
  readonly test: boolean
  readonly data: Readonly<Record<string, unknown>>
  readonly form_schema_version: number | null
  readonly spam: { readonly score: number; readonly reasons: readonly string[] }
  readonly meta: {
    readonly ip?: string
    readonly user_agent?: string
    readonly origin?: string | null
    readonly referer?: string | null
    readonly country?: string | null
    readonly content_type?: string
  }
  readonly received_at: Timestamp
}
export type SubmissionDetail = Submission & {
  readonly deliveries?: readonly Delivery[]
  readonly drift?: readonly DriftEvent[]
}
export type SubmissionList = {
  readonly data: readonly Submission[]
  readonly next_cursor: string | null
}

export type DriftEvent = {
  readonly id: Id
  readonly form_id: Id
  readonly submission_id: Id
  readonly kind: DriftKind
  readonly field: string
  readonly details: Readonly<Record<string, unknown>>
  readonly detected_at: Timestamp
  readonly resolved_at: Timestamp | null
}

export type Stream = {
  readonly id: Id
  readonly slug: Slug
  readonly name: string
  readonly current_schema_version: number | null
  readonly counts: {
    readonly sources: number
    readonly routes: number
    readonly submissions_30d: number
  }
  readonly created_at: Timestamp
}
export type StreamSource = {
  readonly id: Id
  readonly form_id?: Id
  readonly selector?: string
  readonly mapping?: Mapping
  readonly mapping_status?: "valid" | "incomplete"
  readonly missing?: readonly string[]
  readonly stream_schema_version?: number
}
export type StreamDetail = Stream & {
  readonly schema?: SchemaVersion
  readonly sources?: readonly StreamSource[]
  readonly routes?: readonly Route[]
  readonly form_template?: SchemaVersion
}
export type StreamList = { readonly data: readonly Stream[]; readonly next_cursor: string | null }

export type DestinationType = "email" | "telegram" | "webhook" | "slack" | "discord"
export type Destination = {
  readonly id: Id
  readonly type: DestinationType
  readonly name: string
  readonly config: Readonly<Record<string, unknown>>
  readonly health: "unknown" | "ok" | "failing"
  readonly verified: boolean
  readonly created_at: Timestamp
}
export type DestinationList = {
  readonly data: readonly Destination[]
  readonly next_cursor: string | null
}
export type DeliveryResult = {
  readonly ok?: boolean
  readonly status_code?: number | null
  readonly latency_ms?: number
  readonly response_excerpt?: string
  readonly error?: string | null
}

export type Route = {
  readonly id: Id
  readonly form_id: Id | null
  readonly stream_id: Id | null
  readonly destination_id: Id
  readonly enabled: boolean
  readonly mode: {
    readonly type: "instant" | "digest"
    readonly cron?: string
    readonly timezone?: string
  }
  readonly window?: { readonly from?: Timestamp | null; readonly until?: Timestamp | null }
  readonly quality?: { readonly exclude_spam?: boolean; readonly exclude_quarantined?: boolean }
  readonly filter?: string | null
  readonly transform?: string | null
  readonly counts?: { readonly sent_30d?: number; readonly dead_30d?: number }
  readonly created_at?: Timestamp
}
export type RouteList = { readonly data: readonly Route[]; readonly next_cursor: string | null }
export type DeliveryStatus = "pending" | "sending" | "sent" | "failed" | "dead" | "skipped"
export type Delivery = {
  readonly id: Id
  readonly submission_id: Id
  readonly route_id: Id
  readonly destination_id: Id
  readonly status: DeliveryStatus
  readonly skip_reason: "filter" | "window" | "quality" | "paused" | "over_quota" | null
  readonly attempts: number
  readonly next_attempt_at: Timestamp | null
  readonly schema_version: number | null
  readonly payload: Readonly<Record<string, unknown>>
  readonly last_response?: DeliveryResult
  readonly last_error: string | null
  readonly created_at: Timestamp
  readonly sent_at: Timestamp | null
}
export type DeliveryList = {
  readonly data: readonly Delivery[]
  readonly next_cursor: string | null
}
export type Digest = {
  readonly id: Id
  readonly organization_id: Id
  readonly route_id: Id
  readonly period_key: string
  readonly status: "open" | "ready" | "sent" | "failed"
}

export type EventType =
  | "submission.received"
  | "submission.quarantined"
  | "submission.spam"
  | "delivery.sent"
  | "delivery.failed"
  | "delivery.dead"
  | "digest.ready"
  | "form.created"
  | "form.schema.changed"
  | "stream.schema.changed"
  | "drift.detected"
  | "drift.resolved"
  | "destination.failing"
  | "destination.recovered"
export type Event = {
  readonly id: Id
  readonly type: EventType
  readonly subject: {
    readonly form_id?: Id
    readonly stream_id?: Id
    readonly submission_id?: Id
    readonly delivery_id?: Id
    readonly destination_id?: Id
  }
  readonly data: Readonly<Record<string, unknown>>
  readonly created_at: Timestamp
}
export type EventList = { readonly data: readonly Event[]; readonly next_cursor: string | null }
export type SystemWebhook = {
  readonly id: Id
  readonly url: string
  readonly events: readonly EventType[]
  readonly secret?: string
  readonly enabled?: boolean
  readonly health?: "unknown" | "ok" | "failing"
}

const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/u)
const JsonObjectSchema = z.record(z.string(), z.json())
const EventTypeSchema = z.enum([
  "submission.received",
  "submission.quarantined",
  "submission.spam",
  "delivery.sent",
  "delivery.failed",
  "delivery.dead",
  "digest.ready",
  "form.created",
  "form.schema.changed",
  "stream.schema.changed",
  "drift.detected",
  "drift.resolved",
  "destination.failing",
  "destination.recovered",
])

export const SchemaInputSchema = z.object({
  json_schema: JsonObjectSchema,
  ui: z.record(z.string(), JsonObjectSchema).optional(),
  changelog: z.string().optional(),
})
export type SchemaInput = Readonly<z.input<typeof SchemaInputSchema>>

export const ProjectInputSchema = z.object({
  name: z.string().min(1).optional(),
  slug: SlugSchema.optional(),
  tags: z.array(z.string()).default([]),
  if_exists: z.enum(["error", "return"]).default("error"),
})
export type ProjectInput = Readonly<z.input<typeof ProjectInputSchema>>

const FormSettingsSchema = z.object({
  allowed_origins: z.array(z.url()).default([]),
  redirect_url: z.url().nullable().optional(),
  honeypot_field: z.string().default("_gotcha"),
  turnstile: z
    .object({ secret: z.string().optional(), enabled: z.boolean().optional() })
    .optional(),
  rate_limit: z
    .object({
      per_minute: z.number().int().positive().default(10),
      burst: z.number().int().positive().default(20),
    })
    .optional(),
  reply_to_field: z.string().nullable().optional(),
})

export const FormInputSchema = z.object({
  name: z.string().min(1).optional(),
  slug: SlugSchema.optional(),
  project: z.string().default("default"),
  tags: z.array(z.string()).default([]),
  status: z.enum(["active", "paused"]).default("active"),
  schema_mode: z.enum(["observe", "enforce", "managed"]).default("observe"),
  settings: FormSettingsSchema.optional(),
  schema: SchemaInputSchema.optional(),
  from_template: z.string().startsWith("st_").optional(),
  if_exists: z.enum(["error", "return"]).default("error"),
})
export type FormInput = Readonly<z.input<typeof FormInputSchema>>

const MappingEntrySchema = z
  .object({
    from: z.string().optional(),
    const: z.json().optional(),
    expr: z.string().optional(),
    default: z.json().optional(),
  })
  .superRefine((value, context) => {
    const sources = [value.from !== undefined, value.const !== undefined, value.expr !== undefined]
    if (sources.filter(Boolean).length !== 1)
      context.addIssue({
        code: "custom",
        message: "Exactly one of from, const, or expr is required.",
      })
  })
const MappingSchema = z.record(z.string(), MappingEntrySchema)

export const StreamSourceInputSchema = z
  .object({
    form_id: z.string().startsWith("fm_").optional(),
    selector: z.string().optional(),
    mapping: MappingSchema.default({}),
  })
  .superRefine((value, context) => {
    if ((value.form_id === undefined) === (value.selector === undefined)) {
      context.addIssue({
        code: "custom",
        message: "Exactly one of form_id or selector is required.",
      })
    }
  })
export type StreamSourceInput = Readonly<z.input<typeof StreamSourceInputSchema>>

export const StreamInputSchema = z.object({
  name: z.string().min(1).optional(),
  slug: SlugSchema.optional(),
  schema: SchemaInputSchema.optional(),
  sources: z.array(StreamSourceInputSchema).default([]),
  if_exists: z.enum(["error", "return"]).default("error"),
})
export type StreamInput = Readonly<z.input<typeof StreamInputSchema>>

const EmailDestinationInputSchema = z.object({
  type: z.literal("email"),
  name: z.string().optional(),
  config: z.object({
    to: z.array(z.email()).min(1),
    cc: z.array(z.email()).default([]),
    subject_template: z.string().default("New submission: {{form.name}}"),
    from_name: z.string().optional(),
  }),
})
const TelegramDestinationInputSchema = z.object({
  type: z.literal("telegram"),
  name: z.string().optional(),
  config: z.object({
    bot_token: z.string().min(1),
    chat_id: z.string().min(1),
    template: z.string().optional(),
  }),
})
const WebhookDestinationInputSchema = z.object({
  type: z.literal("webhook"),
  name: z.string().optional(),
  config: z.object({
    url: z.url(),
    secret: z.string().optional(),
    headers: z.record(z.string(), z.string()).default({}),
  }),
})
const IncomingWebhookDestinationInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("slack"),
    name: z.string().optional(),
    config: z.object({ url: z.url(), template: z.string().optional() }),
  }),
  z.object({
    type: z.literal("discord"),
    name: z.string().optional(),
    config: z.object({ url: z.url(), template: z.string().optional() }),
  }),
])
export const DestinationInputSchema = z.union([
  EmailDestinationInputSchema,
  TelegramDestinationInputSchema,
  WebhookDestinationInputSchema,
  IncomingWebhookDestinationInputSchema,
])
export type DestinationInput = Readonly<z.input<typeof DestinationInputSchema>>

const RouteModeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("instant") }),
  z.object({ type: z.literal("digest"), cron: z.string().min(1), timezone: z.string().min(1) }),
])
export const RouteInputSchema = z
  .object({
    form_id: z.string().startsWith("fm_").optional(),
    stream_id: z.string().startsWith("st_").optional(),
    destination_id: z.string().startsWith("ds_"),
    enabled: z.boolean().default(true),
    mode: RouteModeSchema.default({ type: "instant" }),
    window: z
      .object({
        from: z.iso.datetime().nullable().optional(),
        until: z.iso.datetime().nullable().optional(),
      })
      .optional(),
    quality: z
      .object({
        exclude_spam: z.boolean().default(true),
        exclude_quarantined: z.boolean().default(true),
      })
      .optional(),
    filter: z.string().optional(),
    transform: z.string().optional(),
  })
  .superRefine((value, context) => {
    if ((value.form_id === undefined) === (value.stream_id === undefined)) {
      context.addIssue({
        code: "custom",
        message: "Exactly one of form_id or stream_id is required.",
      })
    }
  })
export type RouteInput = Readonly<z.input<typeof RouteInputSchema>>

export const QuickstartInputSchema = z.object({
  name: z.string().min(1),
  project: z.string().default("default"),
  origin: z.url().optional(),
  notify_email: z.email().optional(),
  telegram: z.object({ bot_token: z.string(), chat_id: z.string() }).optional(),
  webhook: z.object({ url: z.url(), secret: z.string().optional() }).optional(),
  tags: z.array(z.string()).default([]),
  redirect_url: z.url().optional(),
})
export type QuickstartInput = Readonly<z.input<typeof QuickstartInputSchema>>

export const SystemWebhookInputSchema = z.object({
  url: z.url(),
  events: z.array(EventTypeSchema).min(1),
  secret: z.string().optional(),
  enabled: z.boolean().default(true),
})
export type SystemWebhookInput = Readonly<z.input<typeof SystemWebhookInputSchema>>
