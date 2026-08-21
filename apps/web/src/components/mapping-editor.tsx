import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PostbagApiError } from "@/lib/api"
import { useUpdateStreamSource } from "@/lib/queries/streams"

type MappingRule = { readonly from?: string; readonly const?: unknown }

const UNMAPPED = "__unmapped__"
const CONST = "__const__"

export function MappingEditor({
  streamId,
  sourceId,
  bagFields,
  requiredFields,
  formFields,
  initialMapping,
  missing,
}: {
  readonly streamId: string
  readonly sourceId: string
  readonly bagFields: readonly string[]
  readonly requiredFields: readonly string[]
  readonly formFields: readonly string[]
  readonly initialMapping: Readonly<Record<string, MappingRule>>
  readonly missing: readonly string[]
}) {
  const [mapping, setMapping] = useState<Record<string, MappingRule>>(initialMapping)
  const [constDrafts, setConstDrafts] = useState<Record<string, string>>({})
  const [liveMissing, setLiveMissing] = useState<readonly string[]>(missing)
  const updateSource = useUpdateStreamSource(streamId)

  function selectValueFor(field: string): string {
    const rule = mapping[field]
    if (rule === undefined) return UNMAPPED
    if (rule.const !== undefined) return CONST
    return rule.from !== undefined ? `field:${rule.from}` : UNMAPPED
  }

  function onSelect(field: string, value: string) {
    if (value === UNMAPPED) {
      setMapping((m) => Object.fromEntries(Object.entries(m).filter(([key]) => key !== field)))
    } else if (value === CONST) {
      setMapping((m) => ({ ...m, [field]: { const: constDrafts[field] ?? "" } }))
    } else {
      setMapping((m) => ({ ...m, [field]: { from: value.replace("field:", "") } }))
    }
  }

  async function save() {
    try {
      await updateSource.mutateAsync({ sourceId, body: { mapping } })
      setLiveMissing([])
      toast.success("Mapping saved.")
    } catch (error) {
      if (error instanceof PostbagApiError) {
        const details = error.details as { readonly missing?: readonly string[] } | undefined
        setLiveMissing(details?.missing ?? [])
        toast.error(error.message)
      } else {
        toast.error("Could not save the mapping.")
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
        {bagFields.map((field) => {
          const required = requiredFields.includes(field)
          const isMissing = liveMissing.includes(field)
          const current = selectValueFor(field)
          const constValue = mapping[field]?.const
          const constDefault = typeof constValue === "string" ? constValue : ""
          return (
            <div key={field} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{field}</span>
                {required && <Badge variant={isMissing ? "destructive" : "outline"}>{isMissing ? "missing" : "required"}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                {current === CONST && (
                  <Input
                    className="h-8 w-36"
                    placeholder="value"
                    defaultValue={constDefault}
                    onChange={(e) => {
                      setConstDrafts((d) => ({ ...d, [field]: e.target.value }))
                      setMapping((m) => ({ ...m, [field]: { const: e.target.value } }))
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
                    {formFields.map((f) => (
                      <SelectItem key={f} value={`field:${f}`}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}
      </div>
      <Button size="sm" className="self-start" onClick={() => void save()} disabled={updateSource.isPending}>
        {updateSource.isPending ? "Saving…" : "Save mapping"}
      </Button>
    </div>
  )
}
