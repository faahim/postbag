import type {
  deliveries,
  destinations,
  events,
  forms,
  projects,
  routes,
  streams,
  submissions,
  submissionAttachments,
  systemWebhookDeliveries,
  systemWebhooks,
} from "@postbag/db"
/** Mirrors what `z.json()` (core's schemas) and Hono's `JSONValue` both infer to. Drizzle
 * types jsonb columns as `Readonly<Record<string, unknown>>`; the values are always plain
 * JSON at rest, so re-typing them through this shape for responses is safe. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

/** Every jsonb column here holds an object at the top level, so this returns a record
 * (not the full `Json` union) — that's what the response schemas expect too. */
export function asJson(value: unknown): Record<string, Json> {
  return value as Record<string, Json>
}

export type ProjectRow = typeof projects.$inferSelect
export type FormRow = typeof forms.$inferSelect
export type SubmissionRow = typeof submissions.$inferSelect
export type SubmissionAttachmentRow = typeof submissionAttachments.$inferSelect
export type DeliveryRow = typeof deliveries.$inferSelect
export type StreamRow = typeof streams.$inferSelect
export type DestinationRow = typeof destinations.$inferSelect
export type RouteRow = typeof routes.$inferSelect
export type EventRow = typeof events.$inferSelect
export type SystemWebhookRow = typeof systemWebhooks.$inferSelect
export type SystemWebhookDeliveryRow = typeof systemWebhookDeliveries.$inferSelect

export function serializeProject(row: ProjectRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tags: row.tags,
    created_at: row.createdAt.toISOString(),
  }
}

export type FormStreamInfo = {
  readonly id: string
  readonly slug: string
  readonly mappingStatus: "valid" | "incomplete"
}
export type FormCounts = { readonly submissions: number; readonly lastSubmissionAt: Date | null }
export type FormStatus = "active" | "paused"
export type SchemaMode = "observe" | "enforce" | "managed"

export function serializeForm(
  row: FormRow,
  appUrl: string,
  streamsInfo: readonly FormStreamInfo[],
  counts: FormCounts,
) {
  return {
    id: row.id,
    project_id: row.projectId,
    slug: row.slug,
    name: row.name,
    tags: row.tags,
    status: row.status as FormStatus,
    schema_mode: row.schemaMode as SchemaMode,
    current_schema_version: row.currentSchemaVersion,
    settings: asJson(row.settings),
    submit_url: `${appUrl}/s/${row.id}`,
    streams: streamsInfo.map((s) => ({ id: s.id, slug: s.slug, mapping_status: s.mappingStatus })),
    counts: {
      submissions: counts.submissions,
      last_submission_at: counts.lastSubmissionAt?.toISOString() ?? null,
    },
    created_at: row.createdAt.toISOString(),
  }
}

export type SubmissionStatus = "received" | "quarantined" | "spam"

export function serializeSubmission(row: SubmissionRow) {
  return {
    id: row.id,
    form_id: row.formId,
    status: row.status as SubmissionStatus,
    quarantine_reason: row.quarantineReason,
    test: row.test,
    data: asJson(row.data),
    form_schema_version: row.formSchemaVersion,
    spam: { score: row.spam.score, reasons: [...row.spam.reasons] },
    meta: asJson(row.meta),
    received_at: row.receivedAt.toISOString(),
  }
}

export function serializeSubmissionAttachment(row: SubmissionAttachmentRow) {
  return {
    id: row.id,
    form_id: row.formId,
    submission_id: row.submissionId,
    field_name: row.fieldName,
    filename: row.filename,
    content_type: row.contentType,
    size_bytes: row.sizeBytes,
    sha256: row.sha256,
    download_url: `/v1/attachments/${row.id}/download`,
    created_at: row.createdAt.toISOString(),
  }
}

export type DeliveryStatus = "pending" | "sending" | "sent" | "failed" | "dead" | "skipped"

export function serializeDelivery(row: DeliveryRow) {
  return {
    id: row.id,
    submission_id: row.submissionId,
    route_id: row.routeId,
    destination_id: row.destinationId,
    status: row.status as DeliveryStatus,
    skip_reason: row.skipReason,
    attempts: row.attempts,
    next_attempt_at: row.nextAttemptAt?.toISOString() ?? null,
    schema_version: row.schemaVersion,
    payload: asJson(row.payload),
    last_response: row.lastResponse === null ? undefined : asJson(row.lastResponse),
    last_error: row.lastError,
    created_at: row.createdAt.toISOString(),
    sent_at: row.sentAt?.toISOString() ?? null,
  }
}

export type StreamCounts = {
  readonly sources: number
  readonly routes: number
  readonly submissions30d: number
}

export function serializeStream(row: StreamRow, counts: StreamCounts) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    current_schema_version: row.currentSchemaVersion,
    counts: {
      sources: counts.sources,
      routes: counts.routes,
      submissions_30d: counts.submissions30d,
    },
    created_at: row.createdAt.toISOString(),
  }
}

export type DestinationType = "email" | "telegram" | "webhook" | "slack" | "discord"
export type Health = "unknown" | "ok" | "failing"

export function serializeDestination(row: DestinationRow, redactedConfig: unknown) {
  return {
    id: row.id,
    type: row.type as DestinationType,
    name: row.name,
    config: asJson(redactedConfig),
    health: row.health as Health,
    verified: row.verified,
    created_at: row.createdAt.toISOString(),
  }
}

export function serializeRoute(row: RouteRow) {
  return {
    id: row.id,
    form_id: row.formId,
    stream_id: row.streamId,
    destination_id: row.destinationId,
    enabled: row.enabled,
    mode: asJson(row.mode),
    window: asJson(row.window),
    quality: asJson(row.quality),
    filter: row.filter,
    transform: row.transform,
    created_at: row.createdAt.toISOString(),
  }
}

export function serializeEvent(row: EventRow) {
  return {
    id: row.id,
    type: row.type,
    subject: asJson(row.subject),
    data: asJson(row.data),
    created_at: row.createdAt.toISOString(),
  }
}

export function serializeSystemWebhook(row: SystemWebhookRow) {
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    enabled: row.enabled,
    health: row.health as Health,
  }
}

export function serializeSystemWebhookDelivery(row: SystemWebhookDeliveryRow) {
  return {
    id: row.id,
    webhook_id: row.webhookId,
    event_id: row.eventId,
    event_type: row.eventType,
    status: row.status as "pending" | "sending" | "sent" | "failed" | "dead",
    attempts: row.attempts,
    next_attempt_at: row.nextAttemptAt?.toISOString() ?? null,
    payload: asJson(row.payload),
    last_response: row.lastResponse === null ? undefined : asJson(row.lastResponse),
    last_error: row.lastError,
    created_at: row.createdAt.toISOString(),
    sent_at: row.sentAt?.toISOString() ?? null,
  }
}
