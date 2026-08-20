import { and, count, eq, max } from "drizzle-orm"
import { forms, streamSources, streams, submissions, type Database } from "@postbag/db"

import type { FormCounts, FormStreamInfo } from "./serialize.js"

export async function getFormCounts(db: Database, organizationId: string, formId: string): Promise<FormCounts> {
  const [row] = await db
    .select({ submissions: count(), lastSubmissionAt: max(submissions.receivedAt) })
    .from(submissions)
    .where(and(eq(submissions.organizationId, organizationId), eq(submissions.formId, formId)))
  return { submissions: row?.submissions ?? 0, lastSubmissionAt: row?.lastSubmissionAt ?? null }
}

export async function getFormStreams(
  db: Database,
  organizationId: string,
  formId: string,
): Promise<readonly FormStreamInfo[]> {
  const rows = await db
    .select({
      id: streams.id,
      slug: streams.slug,
      mappingStatus: streamSources.mappingStatus,
    })
    .from(streamSources)
    .innerJoin(streams, eq(streams.id, streamSources.streamId))
    .where(and(eq(streamSources.organizationId, organizationId), eq(streamSources.formId, formId)))
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    mappingStatus: row.mappingStatus === "incomplete" ? "incomplete" : "valid",
  }))
}

export type FormRow = typeof forms.$inferSelect

export async function getFormById(db: Database, organizationId: string, formId: string): Promise<FormRow | null> {
  const [row] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.organizationId, organizationId), eq(forms.id, formId)))
    .limit(1)
  return row ?? null
}
