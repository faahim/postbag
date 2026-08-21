import { and, eq, isNull } from "drizzle-orm"
import { forms, type Database } from "@postbag/db"

import type { Logger } from "../logger.js"
import { inferFormSchemaDraft } from "../repo/schemaInference.js"

/**
 * Job D §4 housekeeping loop: every 10 minutes (see HOUSEKEEPING_INTERVAL_MS in
 * worker/index.ts), re-infer a draft schema for every `observe`-mode form that has no
 * published schema yet. Publishing stays a separate, explicit act
 * (POST /v1/forms/{id}/schema with a body) — this only ever writes `form_schema_drafts`.
 */
export async function runSchemaInferenceSweep(db: Database, logger: Logger): Promise<void> {
  const eligible = await db
    .select({ id: forms.id, organizationId: forms.organizationId })
    .from(forms)
    .where(and(eq(forms.schemaMode, "observe"), isNull(forms.currentSchemaVersion)))

  for (const form of eligible) {
    try {
      await inferFormSchemaDraft(db, form.organizationId, form.id)
    } catch (error) {
      logger.warn({ err: error, form_id: form.id }, "schema inference sweep failed for form")
    }
  }
}
