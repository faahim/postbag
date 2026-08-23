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
  json_schema: JsonRecord.describe("JSON Schema draft 2020-12 describing the submission data. `required` drives drift detection and mapping completeness."),
  ui: z
    .record(z.string(), JsonRecord)
    .optional()
    .describe("Per-field rendering hints keyed by field name (label, placeholder, widget, options, order) — used to render embed snippets."),
  changelog: z.string().optional().describe("A short human note on what changed in this version, shown in the version history."),
})

// Same shape as core's StreamSourceInputSchema/Mapping, minus the recursive z.json()
// `const`/`default` fields and the superRefine (exactly one of from/const/expr) that
// also breaks OpenAPI doc generation. Runtime shape validation is unaffected; the
// "exactly one of" invariant is still enforced downstream by core's validateMapping.
const SafeMappingEntrySchema = z.object({
  from: z.string().optional().describe("Copy this field's value from the source form's submitted data."),
  const: z.unknown().optional().describe("Use this fixed value instead of anything from the source."),
  expr: z.string().optional().describe("A JSONata expression evaluated against the source's data."),
  default: z.unknown().optional().describe("Fallback value when the resolved value is missing."),
})
export const SafeMappingSchema = z.record(z.string(), SafeMappingEntrySchema)
export const SafeStreamSourceInputSchema = z.object({
  form_id: z.string().optional().describe("The form feeding this stream (mutually exclusive with `selector` in principle, though only one source kind is currently supported)."),
  selector: z.string().optional().describe("Reserved for non-form sources (not yet implemented)."),
  mapping: SafeMappingSchema.optional().describe(
    "Keyed by the stream schema's field names. Each entry is exactly one of `from` (copy a field from the form's data), " +
      "`const` (a fixed value) or `expr` (a JSONata expression), plus an optional `default`. Every required field in the " +
      "stream's schema must be covered or this call fails 422 mapping_incomplete.",
  ),
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
    quarantine_reason: z.string().nullable().describe(
      "Machine-readable reason when status is quarantined: schema_violation, rate_limited, origin_rejected, turnstile_failed, or over_quota. Null for received or spam submissions.",
    ),
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

export const SystemWebhookDeliverySchema = z
  .object({
    id: IdSchema,
    webhook_id: IdSchema,
    event_id: IdSchema,
    event_type: z.string(),
    status: z.enum(["pending", "sending", "sent", "failed", "dead"]),
    attempts: z.number().int(),
    next_attempt_at: TimestampSchema.nullable(),
    payload: JsonRecord,
    last_response: DeliveryResultSchema.optional(),
    last_error: z.string().nullable(),
    created_at: TimestampSchema,
    sent_at: TimestampSchema.nullable(),
  })
  .openapi("SystemWebhookDelivery")

// Job K: plan_source on organizations, complimentary access via grant codes.
export const PlanSchema = z.enum(["free", "pro", "team", "selfhost"])
export const PlanSourceSchema = z.enum(["free", "billing", "complimentary", "selfhost"])

export const PlanGrantCreateInputSchema = z.object({
  plan: PlanSchema.describe("The tier this code grants on redemption."),
  note: z.string().max(280).optional().describe('Shown to the redeeming org, e.g. "Courtesy of Postbag".'),
  expires_at: z.iso.datetime().optional().describe("When the code itself stops being redeemable. Omit for a code that never expires on its own."),
  max_redemptions: z.number().int().min(1).optional().default(1).describe("How many different organizations may redeem this code."),
  plan_duration_days: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("How many days after redemption the granted plan lasts. Omit for a grant with no automatic expiry."),
})

export const PlanGrantSummarySchema = z
  .object({
    id: IdSchema,
    plan: PlanSchema,
    note: z.string().nullable(),
    expires_at: TimestampSchema.nullable(),
    plan_duration_days: z.number().int().nullable(),
    max_redemptions: z.number().int(),
    redeemed_count: z.number().int(),
    created_by_user_id: z.string(),
    created_at: TimestampSchema,
    revoked_at: TimestampSchema.nullable(),
  })
  .openapi("PlanGrant")

export const PlanGrantCreatedSchema = PlanGrantSummarySchema.extend({
  code: z.string().describe("Shown once — store it immediately. Only its hash is kept."),
}).openapi("PlanGrantCreated")

export const OrganizationPlanSchema = z
  .object({
    plan: PlanSchema,
    plan_source: PlanSourceSchema,
    plan_expires_at: TimestampSchema.nullable(),
    plan_note: z.string().nullable(),
  })
  .openapi("OrganizationPlan")

export const PlanRedeemInputSchema = z.object({ code: z.string().min(1).describe("A code minted by POST /v1/admin/plan-grants.") })

export const PlanRedeemResponseSchema = OrganizationPlanSchema.extend({
  next: NextSchema,
}).openapi("PlanRedeemResult")

// Job L — members, invitations, roles, org switcher.
export const MemberRoleSchema = z.enum(["owner", "admin", "member"])

export const OrganizationSummarySchema = z
  .object({
    id: IdSchema,
    slug: z.string(),
    name: z.string(),
    role: MemberRoleSchema.nullable().describe(
      "The caller's role in this organization. Null when the caller is an API key — keys are org-scoped, not user-scoped, so they have no membership role of their own.",
    ),
    is_active: z.boolean(),
  })
  .openapi("OrganizationSummary")

export const MemberSchema = z
  .object({
    id: IdSchema,
    user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    role: MemberRoleSchema,
    joined_at: TimestampSchema,
  })
  .openapi("Member")

export const UpdateMemberRoleInputSchema = z.object({ role: MemberRoleSchema })

export const InvitedBySchema = z
  .object({ id: z.string(), name: z.string(), email: z.string() })
  .nullable()
  .describe("Null when the invitation was created by an API key rather than a signed-in session.")

export const InvitationSchema = z
  .object({
    id: IdSchema,
    email: z.string(),
    role: MemberRoleSchema,
    expires_at: TimestampSchema,
    invited_by: InvitedBySchema,
    created_at: TimestampSchema,
  })
  .openapi("Invitation")

export const InvitationCreateInputSchema = z.object({
  email: z.email(),
  role: z.enum(["admin", "member"]).describe("Invite as admin or member. Promote to owner from Members after they join."),
})

export const PublicInvitationSchema = z
  .object({
    organization: z.object({ name: z.string() }),
    invited_by_name: z.string().nullable(),
    role: MemberRoleSchema,
    expires_at: TimestampSchema,
    email_hint: z.string().describe("The invited email, masked, e.g. 'j***@example.com'."),
  })
  .openapi("PublicInvitation")

export const AcceptInvitationResponseSchema = z
  .object({
    organization: z.object({ id: IdSchema, slug: z.string(), name: z.string() }),
    role: MemberRoleSchema,
    next: NextSchema,
  })
  .openapi("AcceptInvitationResult")

export const SetActiveOrganizationInputSchema = z.object({ organization_id: z.string() })
export const SetActiveOrganizationResponseSchema = z
  .object({ organization: z.object({ id: IdSchema, slug: z.string(), name: z.string() }) })
  .openapi("ActiveOrganization")

export const CreateOrganizationInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
})

export const errorResponses = {
  400: { description: "Error", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  401: { description: "Error", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  403: { description: "Error", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  404: { description: "Not found", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  409: { description: "Error", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
  422: { description: "Error", content: { "application/json": { schema: ErrorEnvelopeSchema } } },
} as const
