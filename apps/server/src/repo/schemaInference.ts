import { inferSchema } from "@postbag/core"
import { and, desc, eq, ne } from "drizzle-orm"
import { formSchemaDrafts, submissions, type Database } from "@postbag/db"

const SAMPLE_LIMIT = 200

/**
 * Job D §4: for an `observe`-mode form with no published schema, infer one from the last
 * 200 non-spam submissions and store it as an unpublished draft (one row per form,
 * overwritten on re-infer). Publishing stays an explicit act — this never touches
 * `form_schemas` or `forms.current_schema_version`. Returns the sample count used, or
 * `null` if there was nothing to infer from (no non-spam submissions yet).
 */
export async function inferFormSchemaDraft(
  db: Database,
  organizationId: string,
  formId: string,
): Promise<number | null> {
  const samples = await db
    .select({ data: submissions.data })
    .from(submissions)
    .where(and(eq(submissions.organizationId, organizationId), eq(submissions.formId, formId), ne(submissions.status, "spam")))
    .orderBy(desc(submissions.receivedAt))
    .limit(SAMPLE_LIMIT)

  if (samples.length === 0) return null

  const inferred = inferSchema(samples.map((row) => row.data))

  await db
    .insert(formSchemaDrafts)
    .values({
      organizationId,
      formId,
      jsonSchema: inferred.jsonSchema,
      ui: inferred.ui,
      sampleCount: samples.length,
      inferredAt: new Date(),
    })
    .onConflictDoUpdate({
      target: formSchemaDrafts.formId,
      set: {
        jsonSchema: inferred.jsonSchema,
        ui: inferred.ui,
        sampleCount: samples.length,
        inferredAt: new Date(),
      },
    })

  return samples.length
}
