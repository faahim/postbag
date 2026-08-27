import { and, eq, isNotNull } from "drizzle-orm"
import { routes, streamSchemas, streamSources, streams, type Database } from "@postbag/db"
import type { RoutingRoute, StreamMembership } from "@postbag/core"

export type FormForRouting = {
  readonly id: string
  readonly organizationId: string
  readonly projectId: string
  readonly tags: readonly string[]
}

function toRoutingRoute(row: typeof routes.$inferSelect): RoutingRoute {
  const window = row.window as { readonly from?: string | null; readonly until?: string | null }
  const quality = row.quality as {
    readonly exclude_spam?: boolean
    readonly exclude_quarantined?: boolean
  }
  const mode = row.mode as { readonly type: "instant" | "digest"; readonly cron?: string; readonly timezone?: string }
  return {
    id: row.id,
    destinationId: row.destinationId,
    enabled: row.enabled,
    window: {
      from: window.from === null || window.from === undefined ? null : new Date(window.from),
      until: window.until === null || window.until === undefined ? null : new Date(window.until),
    },
    quality: {
      excludeSpam: quality.exclude_spam ?? true,
      excludeQuarantined: quality.exclude_quarantined ?? true,
    },
    mode:
      mode.type === "digest" && mode.cron !== undefined && mode.timezone !== undefined
        ? { type: "digest", cron: mode.cron, timezone: mode.timezone }
        : { type: "instant" },
  }
}

export async function getDirectRoutesForForm(
  db: Database,
  organizationId: string,
  formId: string,
): Promise<readonly RoutingRoute[]> {
  const rows = await db
    .select()
    .from(routes)
    .where(and(eq(routes.organizationId, organizationId), eq(routes.formId, formId)))
  return rows.map(toRoutingRoute)
}

export function matchesSelector(selector: string, form: FormForRouting): boolean {
  if (selector.startsWith("tag:")) return form.tags.includes(selector.slice("tag:".length))
  if (selector.startsWith("project:")) return form.projectId === selector.slice("project:".length)
  return false
}

export type StreamMembershipWithMapping = StreamMembership & {
  readonly mapping: Readonly<Record<string, unknown>>
  readonly streamSlug: string
}

export async function getStreamMembershipsForForm(
  db: Database,
  form: FormForRouting,
): Promise<readonly StreamMembershipWithMapping[]> {
  const explicit = await db
    .select()
    .from(streamSources)
    .where(and(eq(streamSources.organizationId, form.organizationId), eq(streamSources.formId, form.id)))
  const selectorRows = await db
    .select()
    .from(streamSources)
    .where(and(eq(streamSources.organizationId, form.organizationId), isNotNull(streamSources.selector)))
  const matchingSelectors = selectorRows.filter(
    (row) => row.selector !== null && matchesSelector(row.selector, form),
  )

  const byStream = new Map<string, (typeof explicit)[number]>()
  for (const row of matchingSelectors) byStream.set(row.streamId, row)
  for (const row of explicit) byStream.set(row.streamId, row)
  if (byStream.size === 0) return []

  const memberships: StreamMembershipWithMapping[] = []
  for (const [streamId, source] of byStream) {
    const [stream] = await db.select().from(streams).where(eq(streams.id, streamId)).limit(1)
    if (stream === undefined || source.mappingStatus === "incomplete") continue
    const streamRoutes = await db
      .select()
      .from(routes)
      .where(and(eq(routes.organizationId, form.organizationId), eq(routes.streamId, streamId)))
    memberships.push({
      streamId,
      schemaVersion: stream.currentSchemaVersion,
      routes: streamRoutes.map(toRoutingRoute),
      mapping: source.mapping,
      streamSlug: stream.slug,
    })
  }
  return memberships
}

export async function getStreamSchemaJson(
  db: Database,
  organizationId: string,
  streamId: string,
  version: number,
): Promise<Readonly<Record<string, unknown>> | null> {
  const [row] = await db
    .select({ jsonSchema: streamSchemas.jsonSchema })
    .from(streamSchemas)
    .where(
      and(
        eq(streamSchemas.organizationId, organizationId),
        eq(streamSchemas.streamId, streamId),
        eq(streamSchemas.version, version),
      ),
    )
    .limit(1)
  return row?.jsonSchema ?? null
}
