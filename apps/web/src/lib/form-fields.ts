import { useFormSchema } from "@/lib/queries/forms"
import { useFormSubmissions } from "@/lib/queries/submissions"

/** A form's fields as a "known fields" list — declared schema properties (managed/enforced
 * forms) union'd with the keys of its most recent submission (observe-mode forms have no
 * declared schema at all, but still have real field names worth offering). Returns `pending`
 * while either half is still loading so callers can tell "no fields" from "not yet". */
export function useFormKnownFields(formId: string | undefined): {
  readonly fields: readonly string[]
  readonly required: readonly string[]
  readonly pending: boolean
} {
  const schema = useFormSchema(formId)
  const submissions = useFormSubmissions(formId)
  const jsonSchema = schema.data?.json_schema as { properties?: Record<string, unknown>; required?: string[] } | undefined
  const fromSchema = Object.keys(jsonSchema?.properties ?? {})
  const fromSubmission = Object.keys(submissions.data?.data[0]?.data ?? {})
  return {
    fields: Array.from(new Set([...fromSchema, ...fromSubmission])),
    required: jsonSchema?.required ?? [],
    pending: formId !== undefined && (schema.isPending || submissions.isPending),
  }
}
