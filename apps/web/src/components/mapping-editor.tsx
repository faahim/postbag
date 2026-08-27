import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PostbagApiError, toastApiError } from "@/lib/api"
import {
  formatMappingConstant,
  initialMappingConstant,
  isMappingSourcePathValid,
  mappingRuleWithConstant,
  mappingRuleWithSource,
  parseMappingConstant,
  type JsonSchemaProperty,
  type JsonSchemaRoot,
} from "@/lib/mapping-constants"
import { useUpdateStreamSource } from "@/lib/queries/streams"

type MappingRule = { readonly from?: string; readonly const?: unknown; readonly default?: unknown; readonly expr?: string }

const UNMAPPED = "__unmapped__"
const CONST = "__const__"
const SOURCE_FIELD = "__source_field__"

export function MappingEditor({
  streamId,
  sourceId,
  streamFields,
  requiredFields,
  streamProperties,
  streamSchema,
  formFields,
  initialMapping,
  missing,
  freeformSource = false,
}: {
  readonly streamId: string
  readonly sourceId: string
  readonly streamFields: readonly string[]
  readonly requiredFields: readonly string[]
  readonly streamProperties: Readonly<Record<string, JsonSchemaProperty>>
  readonly streamSchema: JsonSchemaRoot
  readonly formFields: readonly string[]
  readonly initialMapping: Readonly<Record<string, MappingRule>>
  readonly missing: readonly string[]
  /** Selector sources can represent several Forms, so their source field path is entered
   * directly instead of pretending one Form's known-field list is exhaustive. */
  readonly freeformSource?: boolean
}) {
  const [mapping, setMapping] = useState<Record<string, MappingRule>>(initialMapping)
  const [constDrafts, setConstDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initialMapping)
        .filter(([, rule]) => rule.const !== undefined)
        .map(([field, rule]) => [field, formatMappingConstant(rule.const)]),
    ),
  )
  const [liveMissing, setLiveMissing] = useState<readonly string[]>(missing)
  const updateSource = useUpdateStreamSource(streamId)

  function selectValueFor(field: string): string {
    const rule = mapping[field]
    if (rule === undefined) return UNMAPPED
    if (rule.const !== undefined) return CONST
    if (rule.from === undefined) return UNMAPPED
    return freeformSource ? SOURCE_FIELD : `field:${rule.from}`
  }

  function onSelect(field: string, value: string) {
    if (value === UNMAPPED) {
      setMapping((m) => Object.fromEntries(Object.entries(m).filter(([key]) => key !== field)))
    } else if (value === CONST) {
      const raw = constDrafts[field] ?? initialMappingConstant(streamProperties[field])
      const parsed = parseMappingConstant(raw, streamProperties[field], streamSchema, field)
      setConstDrafts((drafts) => ({ ...drafts, [field]: raw }))
      setMapping((m) => ({
        ...m,
        [field]: mappingRuleWithConstant(m[field], parsed.ok ? parsed.value : raw),
      }))
    } else if (value === SOURCE_FIELD) {
      setMapping((m) => ({
        ...m,
        [field]: mappingRuleWithSource(m[field], m[field]?.from ?? ""),
      }))
    } else {
      setMapping((m) => ({
        ...m,
        [field]: mappingRuleWithSource(m[field], value.replace("field:", "")),
      }))
    }
  }

  const constantErrors = Object.fromEntries(
    streamFields.flatMap((field) => {
      if (mapping[field]?.const === undefined) return []
      const raw = constDrafts[field] ?? formatMappingConstant(mapping[field].const)
      const parsed = parseMappingConstant(raw, streamProperties[field], streamSchema, field)
      return parsed.ok ? [] : [[field, parsed.message]]
    }),
  )
  const sourcePathErrors = Object.fromEntries(
    streamFields.flatMap((field) => {
      const from = mapping[field]?.from
      return freeformSource && !isMappingSourcePathValid(from) ? [[field, "Enter a source field path."]] : []
    }),
  )

  async function save() {
    if (Object.keys(constantErrors).length > 0 || Object.keys(sourcePathErrors).length > 0) return
    try {
      await updateSource.mutateAsync({ sourceId, body: { mapping } })
      setLiveMissing([])
      toast.success("Mapping saved.")
    } catch (error) {
      if (error instanceof PostbagApiError) {
        const details = error.details as { readonly missing?: readonly string[] } | undefined
        setLiveMissing(details?.missing ?? [])
      }
      toastApiError(error, "Couldn't save the mapping — try again.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
        {streamFields.map((field) => {
          const required = requiredFields.includes(field)
          const isMissing = liveMissing.includes(field)
          const current = selectValueFor(field)
          const constValue = mapping[field]?.const
          const constDraft = constDrafts[field] ?? formatMappingConstant(constValue)
          const constantError = constantErrors[field]
          const sourcePathError = sourcePathErrors[field]
          return (
            <div key={field} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{field}</span>
                {required && <Badge variant={isMissing ? "destructive" : "outline"}>{isMissing ? "missing" : "required"}</Badge>}
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {current === CONST && (
                  <Input
                    className="h-8 w-36"
                    placeholder="value"
                    aria-label={`Fixed value for ${field}`}
                    aria-invalid={constantError !== undefined}
                    value={constDraft}
                    onChange={(e) => {
                      const raw = e.target.value
                      const parsed = parseMappingConstant(raw, streamProperties[field], streamSchema, field)
                      setConstDrafts((d) => ({ ...d, [field]: raw }))
                      setMapping((m) => ({ ...m, [field]: mappingRuleWithConstant(m[field], parsed.ok ? parsed.value : raw) }))
                    }}
                  />
                  )}
                  {current === SOURCE_FIELD && (
                  <Input
                    className="h-8 w-36 font-mono"
                    placeholder="source.field"
                    aria-label={`Source field for ${field}`}
                    aria-invalid={sourcePathError !== undefined}
                    value={mapping[field]?.from ?? ""}
                    onChange={(e) => {
                      setMapping((m) => ({ ...m, [field]: mappingRuleWithSource(m[field], e.target.value) }))
                    }}
                  />
                  )}
                  <Select value={current} onValueChange={(v) => { onSelect(field, v) }}>
                  <SelectTrigger className="h-8 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNMAPPED}>Leave unmapped</SelectItem>
                    <SelectItem value={CONST}>Fixed value</SelectItem>
                    {freeformSource ? (
                      <SelectItem value={SOURCE_FIELD}>Map a source field</SelectItem>
                    ) : (
                      formFields.map((f) => (
                        <SelectItem key={f} value={`field:${f}`}>
                          {f}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                  </Select>
                </div>
                {constantError !== undefined && <p role="alert" className="text-xs text-destructive">{constantError}</p>}
                {sourcePathError !== undefined && <p role="alert" className="text-xs text-destructive">{sourcePathError}</p>}
              </div>
            </div>
          )
        })}
      </div>
      <Button
        size="sm"
        className="self-start"
        onClick={() => void save()}
        disabled={updateSource.isPending || Object.keys(constantErrors).length > 0 || Object.keys(sourcePathErrors).length > 0}
      >
        {updateSource.isPending ? "Saving…" : "Save mapping"}
      </Button>
    </div>
  )
}
