import { inferSchema } from "@postbag/core"

import { useFormSchema } from "@/lib/queries/forms"
import { useFormSubmissions } from "@/lib/queries/submissions"

/** Observe-mode Forms have no declared schema, so their usable shape is the union of
 * every field seen in the recent Submission window, not just the newest Submission. */
export function observedFieldNames(
  submissions: readonly { readonly data: Readonly<Record<string, unknown>> }[] | undefined,
): readonly string[] {
  const fields = new Set<string>()
  for (const submission of submissions ?? []) {
    for (const field of Object.keys(submission.data)) fields.add(field)
  }
  return Array.from(fields)
}

/** Infer property schemas from the same recent Submission window used for observed field
 * names. The Stream seed uses these when a Form has no published Schema. */
export function observedPropertySchemas(
  submissions: readonly { readonly data: Readonly<Record<string, unknown>> }[] | undefined,
): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
  const properties = inferSchema((submissions ?? []).map((submission) => submission.data)).jsonSchema["properties"]
  return properties !== null && typeof properties === "object"
    ? (properties as Readonly<Record<string, Readonly<Record<string, unknown>>>>)
    : {}
}

/** A form's fields as a "known fields" list — declared schema properties (managed/enforced
 * forms) union'd with the keys of its recent submissions (observe-mode forms have no
 * declared schema at all, but still have real field names worth offering). Returns `pending`
 * while either half is still loading so callers can tell "no fields" from "not yet". */
export function useFormKnownFields(formId: string | undefined): {
  readonly fields: readonly string[]
  readonly required: readonly string[]
  readonly properties: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly observedProperties: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly jsonSchema: Readonly<Record<string, unknown>> | undefined
  readonly pending: boolean
  readonly failed: boolean
  readonly retry: () => void
} {
  const schema = useFormSchema(formId)
  const submissions = useFormSubmissions(formId)
  const jsonSchema = schema.data?.json_schema as {
    properties?: Record<string, Readonly<Record<string, unknown>>>
    required?: string[]
  } | undefined
  const properties = jsonSchema?.properties ?? {}
  const fromSchema = Object.keys(properties)
  const fromSubmission = observedFieldNames(submissions.data?.data)
  const observedProperties = observedPropertySchemas(submissions.data?.data)
  return {
    fields: Array.from(new Set([...fromSchema, ...fromSubmission])),
    required: jsonSchema?.required ?? [],
    properties,
    observedProperties,
    jsonSchema,
    pending: formId !== undefined && (schema.isPending || submissions.isPending),
    failed: schema.isError || submissions.isError,
    retry: () => {
      void schema.refetch()
      void submissions.refetch()
    },
  }
}
