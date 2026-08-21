import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { Input } from "@/components/ui/input"
import { MappingEditor } from "@/components/mapping-editor"
import { RoutesList } from "@/components/routes-list"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PostbagApiError } from "@/lib/api"
import { useFormSchema, useForms } from "@/lib/queries/forms"
import { useFormSubmissions } from "@/lib/queries/submissions"
import { useAddStreamSource, useStream, useStreamPreview } from "@/lib/queries/streams"

// The generated StreamSource type only requires `id` (the OpenAPI doc under-specifies this
// route's Zod shape) — the server always populates the rest, so the UI can rely on it.
type SourcesTabSource = {
  readonly id: string
  readonly form_id: string
  readonly mapping: Readonly<Record<string, { readonly from?: string; readonly const?: unknown }>>
  readonly mapping_status: "valid" | "incomplete"
  readonly missing: readonly string[]
}

export const Route = createFileRoute("/_app/bags/$bagId")({
  component: BagDetailRoute,
})

function BagDetailRoute() {
  const { bagId } = Route.useParams()
  const stream = useStream(bagId)

  if (stream.isLoading || stream.data === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const schemaProps = (stream.data.schema?.json_schema as { properties?: Record<string, unknown>; required?: string[] } | undefined) ?? undefined
  const bagFields = Object.keys(schemaProps?.properties ?? {})
  const requiredFields = schemaProps?.required ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link to="/bags" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Bags
        </Link>
        <h1 className="text-xl font-semibold">{stream.data.name}</h1>
      </div>

      <Tabs defaultValue="delivered">
        <TabsList>
          <TabsTrigger value="delivered">What gets delivered</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="send-to">Send to</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="delivered">
          <Card>
            <CardContent>
              {bagFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No shared schema published yet. Attach a source and publish a shape for this bag to normalise to.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
                  {bagFields.map((field) => (
                    <li key={field} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-mono">{field}</span>
                      {requiredFields.includes(field) && <Badge variant="outline">required</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          {/* The generated StreamSource type only requires `id` (the OpenAPI doc under-specifies
             this route's Zod shape); the server always populates the rest. */}
          <SourcesTab
            bagId={bagId}
            bagFields={bagFields}
            requiredFields={requiredFields}
            sources={(stream.data.sources ?? []) as unknown as SourcesTabSource[]}
          />
        </TabsContent>

        <TabsContent value="send-to">
          <RoutesList subject={{ streamId: bagId }} />
        </TabsContent>

        <TabsContent value="preview">
          <PreviewTab bagId={bagId} sources={(stream.data.sources ?? []) as unknown as { readonly form_id: string }[]} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** A form's fields as the mapping editor's "known fields" list — declared schema properties
 * (managed/enforced forms) union'd with the keys of its most recent submission (observe-mode
 * forms have no declared schema at all, but still have real field names worth offering). */
function useFormKnownFields(formId: string | undefined): readonly string[] {
  const schema = useFormSchema(formId)
  const submissions = useFormSubmissions(formId)
  const fromSchema = Object.keys(
    (schema.data?.json_schema as { properties?: Record<string, unknown> } | undefined)?.properties ?? {},
  )
  const fromSubmission = Object.keys(submissions.data?.data[0]?.data ?? {})
  return Array.from(new Set([...fromSchema, ...fromSubmission]))
}

function SourcesTab({
  bagId,
  bagFields,
  requiredFields,
  sources,
}: {
  readonly bagId: string
  readonly bagFields: readonly string[]
  readonly requiredFields: readonly string[]
  readonly sources: readonly SourcesTabSource[]
}) {
  const forms = useForms()
  const attachedFormIds = new Set(sources.map((s) => s.form_id))
  const attachable = (forms.data?.data ?? []).filter((f) => !attachedFormIds.has(f.id))

  return (
    <div className="flex flex-col gap-4">
      {sources.length === 0 ? (
        <EmptyState title="No forms attached" description="Attach a form to start mapping its fields into this bag." />
      ) : (
        <div className="flex flex-col gap-4">
          {sources.map((source) => (
            <Card key={source.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-muted-foreground">{source.form_id}</span>
                  <Badge variant={source.mapping_status === "valid" ? "success" : "warning"}>
                    {source.mapping_status === "valid" ? "Mapped" : `Missing ${source.missing.join(", ")}`}
                  </Badge>
                </div>
                {bagFields.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Publish a schema for this bag to map fields.</p>
                ) : (
                  <SourceFieldEditor bagId={bagId} source={source} bagFields={bagFields} requiredFields={requiredFields} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AttachFormPanel bagId={bagId} bagFields={bagFields} requiredFields={requiredFields} attachable={attachable} />
    </div>
  )
}

const UNMAPPED = "__unmapped__"
const CONST = "__const__"

/** Attaching a form to a bag with required fields must include a complete mapping in the
 * same call — `POST /v1/streams/{id}/sources` 422s (`mapping_incomplete`) otherwise, per
 * `packages/core/src/mapping.ts#validateMapping`. So the "Match fields" editor runs *before*
 * the form is attached, not after; the API's 422 (with its `missing` list) drives the error
 * state shown here if a required field still isn't covered. */
function AttachFormPanel({
  bagId,
  bagFields,
  requiredFields,
  attachable,
}: {
  readonly bagId: string
  readonly bagFields: readonly string[]
  readonly requiredFields: readonly string[]
  readonly attachable: readonly { readonly id: string; readonly name: string }[]
}) {
  const addSource = useAddStreamSource(bagId)
  const [pendingFormId, setPendingFormId] = useState<string | undefined>(undefined)
  const [mapping, setMapping] = useState<Record<string, { from?: string; const?: unknown }>>({})
  const [serverMissing, setServerMissing] = useState<readonly string[]>([])
  const formFields = useFormKnownFields(pendingFormId)

  function selectForm(id: string) {
    setPendingFormId(id)
    setMapping({})
    setServerMissing([])
  }

  function onSelect(field: string, value: string) {
    setServerMissing((m) => m.filter((f) => f !== field))
    if (value === UNMAPPED) {
      setMapping((m) => Object.fromEntries(Object.entries(m).filter(([key]) => key !== field)))
    } else if (value === CONST) {
      setMapping((m) => ({ ...m, [field]: { const: "" } }))
    } else {
      setMapping((m) => ({ ...m, [field]: { from: value.replace("field:", "") } }))
    }
  }

  async function attach() {
    if (pendingFormId === undefined) return
    try {
      await addSource.mutateAsync({ form_id: pendingFormId, mapping } as unknown as Parameters<typeof addSource.mutateAsync>[0])
      toast.success("Form attached.")
      setPendingFormId(undefined)
      setMapping({})
      setServerMissing([])
    } catch (error) {
      if (error instanceof PostbagApiError) {
        const details = error.details as { readonly missing?: readonly string[] } | undefined
        setServerMissing(details?.missing ?? [])
        toast.error(error.message)
      } else {
        toast.error("Could not attach form.")
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Select
        value={pendingFormId ?? ""}
        onValueChange={selectForm}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Attach a form…" />
        </SelectTrigger>
        <SelectContent>
          {attachable.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {pendingFormId !== undefined && bagFields.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">Match fields before attaching — required fields need a mapping.</p>
            <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
              {bagFields.map((field) => {
                const required = requiredFields.includes(field)
                const isMissing = serverMissing.includes(field)
                const rule = mapping[field]
                const current = rule === undefined ? UNMAPPED : rule.const !== undefined ? CONST : rule.from !== undefined ? `field:${rule.from}` : UNMAPPED
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
                          onChange={(e) => {
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
          </CardContent>
        </Card>
      )}

      <Button
        variant="outline"
        className="w-fit gap-1.5"
        disabled={pendingFormId === undefined || addSource.isPending}
        onClick={() => void attach()}
      >
        <Plus className="size-4" />
        {addSource.isPending ? "Attaching…" : "Attach form"}
      </Button>
    </div>
  )
}

function SourceFieldEditor({
  bagId,
  source,
  bagFields,
  requiredFields,
}: {
  readonly bagId: string
  readonly source: SourcesTabSource
  readonly bagFields: readonly string[]
  readonly requiredFields: readonly string[]
}) {
  const formFields = useFormKnownFields(source.form_id)
  return (
    <MappingEditor
      streamId={bagId}
      sourceId={source.id}
      bagFields={bagFields}
      requiredFields={requiredFields}
      formFields={formFields}
      initialMapping={source.mapping}
      missing={source.missing}
    />
  )
}

function PreviewTab({
  bagId,
  sources,
}: {
  readonly bagId: string
  readonly sources: readonly { readonly form_id: string }[]
}) {
  const [formId, setFormId] = useState<string | undefined>(sources[0]?.form_id)
  const submissions = useFormSubmissions(formId)
  const [submissionId, setSubmissionId] = useState<string | undefined>(undefined)
  const preview = useStreamPreview(bagId)

  async function run() {
    if (formId === undefined || submissionId === undefined) return
    const submission = submissions.data?.data.find((s) => s.id === submissionId)
    if (submission === undefined) return
    await preview.mutateAsync({ formId, data: submission.data })
  }

  if (sources.length === 0) {
    return <EmptyState title="Attach a form first" description="Preview needs at least one source with recent submissions." />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Select
          value={formId ?? ""}
          onValueChange={(v) => {
            setFormId(v)
            setSubmissionId(undefined)
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Choose a source form" />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.form_id} value={s.form_id}>
                {s.form_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={submissionId ?? ""} onValueChange={setSubmissionId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choose a recent submission" />
          </SelectTrigger>
          <SelectContent>
            {(submissions.data?.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.id} · {new Date(s.received_at).toLocaleString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => void run()} disabled={submissionId === undefined || preview.isPending}>
          {preview.isPending ? "Mapping…" : "Preview"}
        </Button>
      </div>

      {preview.data !== undefined && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            {preview.data.problems.length > 0 && (
              <ul className="flex flex-col gap-1">
                {preview.data.problems.map((p) => (
                  <li key={p} className="text-xs text-destructive">
                    {p}
                  </li>
                ))}
              </ul>
            )}
            <pre className="overflow-auto rounded-lg border border-border/70 bg-muted/50 p-4 font-mono text-[13px]">
              <code>{JSON.stringify(preview.data.payload, null, 2)}</code>
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
