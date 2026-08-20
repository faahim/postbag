import { z } from "@hono/zod-openapi"

export const IdSchema = z.string().openapi({ example: "fm_8f3kq2" })
export const TimestampSchema = z.string().openapi({ example: "2026-08-21T09:00:00.000Z" })
export const ScopeSchema = z.enum(["manage", "read", "submit"])

export const ErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      hint: z.string().optional(),
      docs: z.string().optional(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  })
  .openapi("ErrorEnvelope")

export const NextItemSchema = z.object({
  why: z.string().optional(),
  method: z.string().optional(),
  path: z.string().optional(),
  body: z.record(z.string(), z.unknown()).optional(),
})
export const NextSchema = z.array(NextItemSchema)

export const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export function listSchema<Item extends z.ZodType>(item: Item) {
  return z.object({ data: z.array(item), next_cursor: z.string().nullable() })
}

// z.json() is a recursive schema; @asteasolutions/zod-to-openapi (used by app.doc31())
// walks recursive zod schemas eagerly and blows the call stack. z.unknown() renders as
// an open `{}` in the generated OpenAPI document and has no such recursion problem —
// `asJson()` (repo/serialize.ts) still gives call sites a concrete, non-`unknown` TS type.
export const JsonRecord = z.record(z.string(), z.unknown())

// Same shape as core's SchemaInputSchema (json_schema/ui/changelog), but without the
// recursive z.json() fields that crash OpenAPI doc generation. Validation outcome is
// identical for well-formed JSON Schema documents; only used where a route definition
// needs a request/response schema safe for app.doc31() to walk.
export const SafeSchemaInputSchema = z.object({
  json_schema: JsonRecord,
  ui: z.record(z.string(), JsonRecord).optional(),
  changelog: z.string().optional(),
})

// Same shape as core's StreamSourceInputSchema/Mapping, minus the recursive z.json()
// `const`/`default` fields and the superRefine (exactly one of from/const/expr) that
// also breaks OpenAPI doc generation. Runtime shape validation is unaffected; the
// "exactly one of" invariant is still enforced downstream by core's validateMapping.
const SafeMappingEntrySchema = z.object({
  from: z.string().optional(),
  const: z.unknown().optional(),
  expr: z.string().optional(),
  default: z.unknown().optional(),
})
export const SafeMappingSchema = z.record(z.string(), SafeMappingEntrySchema)
export const SafeStreamSourceInputSchema = z.object({
  form_id: z.string().optional(),
  selector: z.string().optional(),
  mapping: SafeMappingSchema.optional(),
})

export const ProjectSchema = z
  .object({
    id: IdSchema,
    slug: z.string(),
    name: z.string(),
    tags: z.array(z.string()),
    created_at: TimestampSchema,
  })
  .openapi("Project")

export const EmbedSchema = z
  .object({
    html: z.string(),
    fetch: z.string(),
    react: z.string(),
    astro: z.string(),
    nextjs_action: z.string(),
  })
  .openapi("Embed")

export const VerifySchema = z.object({ curl: z.string(), then: z.string() }).openapi("Verify")

export const SchemaVersionSchema = z
  .object({
    json_schema: JsonRecord,
    ui: JsonRecord.optional(),
    changelog: z.string().optional(),
    version: z.number().int().optional(),
    inferred: z.boolean().optional(),
    created_at: TimestampSchema.optional(),
    created_by: z.string().optional(),
  })
  .openapi("SchemaVersion")

export const SchemaInputBodySchema = z
  .object({
    json_schema: JsonRecord,
    ui: JsonRecord.optional(),
    changelog: z.string().optional(),
  })
  .openapi("SchemaInput")

export const FormSchema = z
  .object({
    id: IdSchema,
    project_id: IdSchema,
    slug: z.string(),
    name: z.string(),
    tags: z.array(z.string()),
    status: z.enum(["active", "paused"]),
    schema_mode: z.enum(["observe", "enforce", "managed"]),
    current_schema_version: z.number().int().nullable(),
    settings: JsonRecord,
    submit_url: z.string(),
    streams: z.array(
      z.object({ id: IdSchema, slug: z.string(), mapping_status: z.enum(["valid", "incomplete"]) }),
    ),
    counts: z.object({ submissions: z.number().int(), last_submission_at: TimestampSchema.nullable() }),
    created_at: TimestampSchema,
  })
  .openapi("Form")

export const FormCreatedSchema = FormSchema.extend({
  embed: EmbedSchema.optional(),
  verify: VerifySchema.optional(),
  next: NextSchema.optional(),
}).openapi("FormCreated")

export const SubmissionSchema = z
  .object({
    id: IdSchema,
    form_id: IdSchema,
    status: z.enum(["received", "quarantined", "spam"]),
    quarantine_reason: z.string().nullable(),
    test: z.boolean(),
    data: JsonRecord,
    form_schema_version: z.number().int().nullable(),
    spam: z.object({ score: z.number(), reasons: z.array(z.string()) }),
    meta: JsonRecord,
    received_at: TimestampSchema,
  })
  .openapi("Submission")

export const DeliveryResultSchema = z
  .object({
    ok: z.boolean().optional(),
    status_code: z.number().int().nullable().optional(),
    latency_ms: z.number().optional(),
    response_excerpt: z.string().optional(),
    error: z.string().nullable().optional(),
  })
  .openapi("DeliveryResult")

export const DeliverySchema = z
  .object({
    id: IdSchema,
    submission_id: IdSchema,
    route_id: IdSchema,
    destination_id: IdSchema,
    status: z.enum(["pending", "sending", "sent", "failed", "dead", "skipped"]),
    skip_reason: z.string().nullable(),
    attempts: z.number().int(),
    next_attempt_at: TimestampSchema.nullable(),
    schema_version: z.number().int().nullable(),
    payload: JsonRecord,
    last_response: DeliveryResultSchema.optional(),
    last_error: z.string().nullable(),
    created_at: TimestampSchema,
    sent_at: TimestampSchema.nullable(),
  })
  .openapi("Delivery")

export const SubmissionDetailSchema = SubmissionSchema.extend({
  deliveries: z.array(DeliverySchema).optional(),
  drift: z.array(JsonRecord).optional(),
}).openapi("SubmissionDetail")

export const RouteSchema = z
  .object({
    id: IdSchema,
    form_id: z.string().nullable(),
    stream_id: z.string().nullable(),
    destination_id: IdSchema,
    enabled: z.boolean(),
    mode: JsonRecord,
    window: JsonRecord.optional(),
    quality: JsonRecord.optional(),
    filter: z.string().nullable().optional(),
    transform: z.string().nullable().optional(),
    counts: JsonRecord.optional(),
    created_at: TimestampSchema.optional(),
  })
  .openapi("Route")

export const StreamSchema = z
  .object({
    id: IdSchema,
    slug: z.string(),
    name: z.string(),
    current_schema_version: z.number().int().nullable(),
    counts: z.object({
      sources: z.number().int(),
      routes: z.number().int(),
      submissions_30d: z.number().int(),
    }),
    created_at: TimestampSchema,
  })
  .openapi("Stream")

export const StreamSourceSchema = z
  .object({
    id: IdSchema,
    form_id: IdSchema.optional(),
    selector: z.string().optional(),
    mapping: JsonRecord.optional(),
    mapping_status: z.enum(["valid", "incomplete"]).optional(),
    missing: z.array(z.string()).optional(),
    stream_schema_version: z.number().int().optional(),
  })
  .openapi("StreamSource")

export const StreamDetailSchema = StreamSchema.extend({
  schema: SchemaVersionSchema.optional(),
  sources: z.array(StreamSourceSchema).optional(),
  routes: z.array(RouteSchema).optional(),
  form_template: SchemaVersionSchema.optional(),
}).openapi("StreamDetail")

export const DestinationSchema = z
  .object({
    id: IdSchema,
    type: z.enum(["email", "telegram", "webhook", "slack", "discord"]),
    name: z.string(),
    config: JsonRecord,
    health: z.enum(["unknown", "ok", "failing"]),
    verified: z.boolean(),
    created_at: TimestampSchema,
  })
  .openapi("Destination")

export const EventSchema = z
  .object({
    id: IdSchema,
    type: z.string(),
    subject: JsonRecord,
    data: JsonRecord,
    created_at: TimestampSchema,
  })
  .openapi("Event")

export const SystemWebhookSchema = z
  .object({
    id: IdSchema,
    url: z.string(),
    events: z.array(z.string()),
    enabled: z.boolean().optional(),
    health: z.enum(["unknown", "ok", "failing"]).optional(),
  })
  .openapi("SystemWebhook")

export const errorResponses = {
  400: { description: "Error", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  401: { description: "Error", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  403: { description: "Error", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  404: { description: "Not found", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  409: { description: "Error", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  422: { description: "Error", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
} as const
