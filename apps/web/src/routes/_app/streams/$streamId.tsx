import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Plus, Unlink } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { StreamExplainer } from "@/components/stream-explainer"
import { EmptyState } from "@/components/empty-state"
import { MappingEditor } from "@/components/mapping-editor"
import { RoutesList } from "@/components/routes-list"
import { ShapeEditor } from "@/components/shape-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PostbagApiError, toastApiError } from "@/lib/api"
import { useFormKnownFields } from "@/lib/form-fields"
import { formatDateTime } from "@/lib/format"
import { useForms } from "@/lib/queries/forms"
import { useFormSubmissions } from "@/lib/queries/submissions"
import {
  useAddStreamSource,
  useDeleteStream,
  useRemoveStreamSource,
  useStream,
  useStreamPreview,
  useUpdateStream,
} from "@/lib/queries/streams"

// The generated StreamSource type only requires `id` (the OpenAPI doc under-specifies this
// route's Zod shape) — the server always populates the rest, so the UI can rely on it.
type Source = {
  readonly id: string
  readonly form_id: string
  readonly mapping: Readonly<Record<string, { readonly from?: string; readonly const?: unknown }>>
  readonly mapping_status: "valid" | "incomplete"
  readonly missing: readonly string[]
}

type FormRef = { readonly id: string; readonly name: string }
type StreamTab = "delivered" | "sources" | "send-to" | "preview" | "settings"

export const Route = createFileRoute("/_app/streams/$streamId")({
  component: StreamDetailRoute,
})

function StreamDetailRoute() {
  const { streamId } = Route.useParams()
  const stream = useStream(streamId)
  const forms = useForms()
  // Undefined until the user picks one: a fresh Stream opens on Sources (the one thing to
  // do), while a working Stream opens on its shape.
  const [chosenTab, setTab] = useState<StreamTab | undefined>(undefined)

  if (stream.isPending || stream.data === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const streamData = stream.data
  const schema = streamData.schema
  const schemaProps = schema?.json_schema as { properties?: Record<string, unknown>; required?: string[] } | undefined
  const streamFields = Object.keys(schemaProps?.properties ?? {})
  const requiredFields = schemaProps?.required ?? []
  const sources = (streamData.sources ?? []) as unknown as readonly Source[]
  const routeCount = streamData.routes?.length ?? streamData.counts.routes
  const allForms: readonly FormRef[] = forms.data?.data ?? []
  const formsById = new Map(allForms.map((f) => [f.id, f.name]))
  const fresh = schema === undefined && sources.length === 0
  const tab: StreamTab = chosenTab ?? (fresh ? "sources" : "delivered")

  return (
    <div className="page-enter flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          to="/streams"
          className="group flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-(--duration-quick) hover:text-foreground"
        >
          <ArrowLeft className="size-3.5 transition-transform duration-(--duration-quick) ease-(--ease-smooth-out) group-hover:-translate-x-0.5" />{" "}
          Streams
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{streamData.name}</h1>
          <span className="font-mono text-xs text-muted-foreground">{streamData.id}</span>
        </div>
        {(
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={schema === undefined ? "warning" : "muted"}>
              {schema === undefined ? "No shape yet" : `Shape v${schema.version ?? 1} · ${streamFields.length} ${streamFields.length === 1 ? "field" : "fields"}`}
            </Badge>
            <Badge variant="muted">
              {sources.length} {sources.length === 1 ? "form" : "forms"}
            </Badge>
            <Badge variant="muted">
              {routeCount} {routeCount === 1 ? "route" : "routes"}
            </Badge>
          </div>
        )}
      </div>

      {(
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as StreamTab)
          }}
        >
          <TabsList>
            <TabsTrigger value="delivered">What gets delivered</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="send-to">Send to</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="delivered">
            <Card>
              <CardContent className="flex flex-col gap-4">
                <TabIntro
                  title="The shape"
                  body={
                    schema === undefined
                      ? "The fields every Delivery from this Stream will carry. Attaching the first Form fills this in automatically — or set the fields yourself here."
                      : "Every Delivery from this Stream carries exactly these fields, whichever Form the Submission came from. Fields a Form doesn't provide arrive empty; anything extra a Form sends is kept under “extras”."
                  }
                />
                <ShapeEditor key={schema?.version ?? 0} streamId={streamId} schema={schema} forms={allForms} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sources">
            {fresh ? (
              <StreamExplainer
                title="Many forms in. One tidy shape out."
                lede="Say the same contact Form lives on three of your sites, and each one names its fields a little differently — fullName, name, Namn. A Stream takes everything those Forms receive and lines it up into one shape, so wherever you send it — an inbox, Telegram, a webhook — the same fields always arrive in the same places."
                action={
                  <FirstFormAttach
                    streamId={streamId}
                    forms={allForms}
                    onAttached={() => {
                      setTab("delivered")
                    }}
                  />
                }
                aside={
                  <>
                    Only one Form? You don't need a Stream — route it straight from its own page. Prefer to set the fields yourself first?{" "}
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                      onClick={() => {
                        setTab("delivered")
                      }}
                    >
                      Define the shape under “What gets delivered”
                    </button>
                    .
                  </>
                }
              />
            ) : (
              <SourcesTab
                streamId={streamId}
                streamFields={streamFields}
                requiredFields={requiredFields}
                sources={sources}
                formsById={formsById}
                allForms={allForms}
              />
            )}
          </TabsContent>

          <TabsContent value="send-to">
            <div className="flex flex-col gap-4">
              <TabIntro
                title="Where the Stream goes"
                body="One Route here delivers every Form in the Stream — instead of a Route per Form. Each Delivery uses the shape above."
              />
              <RoutesList subject={{ streamId }} />
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <div className="flex flex-col gap-4">
              <TabIntro
                title="Try it on a real submission"
                body="Pick a recent Submission from one of the attached Forms and see exactly what this Stream would deliver for it. Nothing is sent."
              />
              <PreviewTab streamId={streamId} sources={sources} formsById={formsById} />
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab streamId={streamId} name={streamData.name} routeCount={routeCount} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function SettingsTab({ streamId, name, routeCount }: { readonly streamId: string; readonly name: string; readonly routeCount: number }) {
  const navigate = useNavigate()
  const updateStream = useUpdateStream(streamId)
  const deleteStream = useDeleteStream()
  const [draftName, setDraftName] = useState(name)
  const trimmed = draftName.trim()

  async function rename() {
    if (trimmed.length === 0 || trimmed === name) return
    try {
      await updateStream.mutateAsync({ name: trimmed })
      toast.success(`Renamed to ${trimmed}.`)
    } catch (error) {
      toastApiError(error, "Couldn't rename the Stream — try again.")
    }
  }

  async function remove() {
    const detail = routeCount > 0 ? ` Its ${routeCount} ${routeCount === 1 ? "route stops" : "routes stop"} delivering.` : ""
    if (!window.confirm(`Delete “${name}”? The Forms in it and their Submissions are kept; only the Stream goes.${detail}`)) return
    try {
      await deleteStream.mutateAsync(streamId)
      toast.success(`${name} deleted.`)
      await navigate({ to: "/streams" })
    } catch (error) {
      toastApiError(error, "Couldn't delete the Stream — try again.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stream-rename">Name</Label>
            <div className="flex items-center gap-2">
              <Input
                id="stream-rename"
                value={draftName}
                onChange={(e) => {
                  setDraftName(e.target.value)
                }}
                className="max-w-sm"
              />
              <Button onClick={() => void rename()} disabled={trimmed.length === 0 || trimmed === name || updateStream.isPending}>
                {updateStream.isPending ? "Saving…" : "Save name"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Shown in the dashboard and the API. The id <span className="font-mono">{streamId}</span> never changes.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-destructive">Danger zone</h3>
            <p className="text-xs text-muted-foreground text-pretty">
              Deletes the Stream and its Routes. The Forms in it and every Submission they received are kept.
            </p>
          </div>
          <Button variant="destructive" onClick={() => void remove()} disabled={deleteStream.isPending}>
            Delete Stream
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function TabIntro({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="max-w-2xl text-sm text-muted-foreground text-pretty">{body}</p>
    </div>
  )
}

/** The API's wording is for agents ("stream", ids, endpoints); the dashboard says the same
 * thing in the user's words. Only the one code people actually hit here gets a translation —
 * everything else shows the server's own message and hint. */
function toastAttachError(error: unknown, formName: string | undefined) {
  if (error instanceof PostbagApiError && error.code === "stream_schema_missing") {
    toast.error(`${formName === undefined ? "That form" : `“${formName}”`} has no fields yet.`, {
      description:
        "It hasn't received a Submission and has no published Schema, so there's nothing to shape the Stream from. Send it one test Submission, pick another Form, or define the shape by hand.",
      duration: 8000,
    })
    return
  }
  toastApiError(error, "Couldn't attach that form — try again.")
}

/** The explainer's one action: pick a form, attach it, done. The server copies the form's
 * fields as the Stream's first shape and maps the form onto it one-to-one. */
function FirstFormAttach({
  streamId,
  forms,
  onAttached,
}: {
  readonly streamId: string
  readonly forms: readonly FormRef[]
  readonly onAttached: () => void
}) {
  const addSource = useAddStreamSource(streamId)
  const [formId, setFormId] = useState<string | undefined>(undefined)
  const selected = forms.find((f) => f.id === formId)

  async function attach() {
    if (formId === undefined) return
    try {
      await addSource.mutateAsync({ form_id: formId })
      toast.success(`${selected?.name ?? "Form"} attached.`, {
        description: "Its fields are now the Stream's shape. Attach more Forms under Sources, then send the Stream somewhere.",
      })
      onAttached()
    } catch (error) {
      toastAttachError(error, selected?.name)
    }
  }

  if (forms.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">You have no Forms yet — a Stream needs at least one to collect from.</p>
        <Button asChild className="w-fit">
          <Link to="/forms">Create a form first</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={formId ?? ""} onValueChange={setFormId}>
          <SelectTrigger className="w-64" aria-label="Form to attach">
            <SelectValue placeholder="Choose your first form…" />
          </SelectTrigger>
          <SelectContent>
            {forms.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => void attach()} disabled={formId === undefined || addSource.isPending} className="gap-1.5">
          <Plus className="size-4" />
          {addSource.isPending ? "Attaching…" : "Attach form"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {selected === undefined
          ? "Its fields become the Stream's shape. You can change the shape any time."
          : `“${selected.name}”'s fields become the Stream's shape. You can change it any time.`}
      </p>
    </div>
  )
}

function SourcesTab({
  streamId,
  streamFields,
  requiredFields,
  sources,
  formsById,
  allForms,
}: {
  readonly streamId: string
  readonly streamFields: readonly string[]
  readonly requiredFields: readonly string[]
  readonly sources: readonly Source[]
  readonly formsById: ReadonlyMap<string, string>
  readonly allForms: readonly FormRef[]
}) {
  const attachedFormIds = new Set(sources.map((s) => s.form_id))
  const attachable = allForms.filter((f) => !attachedFormIds.has(f.id))

  return (
    <div className="flex flex-col gap-4">
      <TabIntro
        title="Forms in this Stream"
        body="Every Submission these Forms receive lands in the Stream. Each Form is matched onto the shape field by field — we flag any required field that still has nothing pointing at it."
      />
      {sources.length === 0 ? (
        <EmptyState
          title="No Forms in this Stream yet"
          description={
            streamFields.length === 0
              ? "Attach the first one below — its fields become the Stream's shape, nothing to write."
              : "Attach a form below and match its fields to the shape."
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              streamId={streamId}
              source={source}
              formName={formsById.get(source.form_id)}
              streamFields={streamFields}
              requiredFields={requiredFields}
            />
          ))}
        </div>
      )}

      <AttachFormPanel streamId={streamId} streamFields={streamFields} requiredFields={requiredFields} attachable={attachable} />
    </div>
  )
}

function SourceCard({
  streamId,
  source,
  formName,
  streamFields,
  requiredFields,
}: {
  readonly streamId: string
  readonly source: Source
  readonly formName: string | undefined
  readonly streamFields: readonly string[]
  readonly requiredFields: readonly string[]
}) {
  const known = useFormKnownFields(source.form_id)
  const removeSource = useRemoveStreamSource(streamId)

  async function detach() {
    try {
      await removeSource.mutateAsync(source.id)
      toast.success(`${formName ?? "Form"} detached.`, { description: "Its Submissions stay where they are — they just stop landing in this Stream." })
    } catch (error) {
      toastApiError(error, "Couldn't detach that form — try again.")
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <Link to="/forms/$formId" params={{ formId: source.form_id }} className="truncate text-sm font-medium hover:underline">
              {formName ?? "Form"}
            </Link>
            <span className="font-mono text-xs text-muted-foreground">{source.form_id}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={source.mapping_status === "valid" ? "success" : "warning"}>
              {source.mapping_status === "valid" ? "All fields matched" : `Missing ${source.missing.join(", ")}`}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={() => void detach()}
              disabled={removeSource.isPending}
            >
              <Unlink className="size-3.5" />
              Detach
            </Button>
          </div>
        </div>
        {streamFields.length === 0 ? (
          <p className="text-xs text-muted-foreground">Give the Stream a shape under “What gets delivered” to match this Form's fields.</p>
        ) : (
          <MappingEditor
            streamId={streamId}
            sourceId={source.id}
            streamFields={streamFields}
            requiredFields={requiredFields}
            formFields={known.fields}
            initialMapping={source.mapping}
            missing={source.missing}
          />
        )}
      </CardContent>
    </Card>
  )
}

const UNMAPPED = "__unmapped__"
const CONST = "__const__"

type MappingDraft = Record<string, { from?: string; const?: unknown }>

/** Fields with the same name on both sides start matched; only the rest need a decision. */
function identityDraft(streamFields: readonly string[], formFields: readonly string[]): MappingDraft {
  const known = new Set(formFields)
  return Object.fromEntries(streamFields.filter((f) => known.has(f)).map((f) => [f, { from: f }]))
}

/** Attaching a form to a Stream with required fields must include a complete mapping in the
 * same call — `POST /v1/streams/{id}/sources` 422s (`mapping_incomplete`) otherwise. So the
 * "match fields" editor runs *before* the form is attached; the API's `missing` list drives
 * the error state if a required field still isn't covered. On a Stream with no shape yet the
 * server derives one from the form, so there is nothing to match. */
function AttachFormPanel({
  streamId,
  streamFields,
  requiredFields,
  attachable,
}: {
  readonly streamId: string
  readonly streamFields: readonly string[]
  readonly requiredFields: readonly string[]
  readonly attachable: readonly FormRef[]
}) {
  const addSource = useAddStreamSource(streamId)
  const [pendingFormId, setPendingFormId] = useState<string | undefined>(undefined)
  const [mapping, setMapping] = useState<MappingDraft>({})
  const [serverMissing, setServerMissing] = useState<readonly string[]>([])
  const known = useFormKnownFields(pendingFormId)
  const seededFor = useRef<string | undefined>(undefined)
  const pendingForm = attachable.find((f) => f.id === pendingFormId)

  // Pre-match same-named fields once the form's fields are known (one-shot per selection).
  useEffect(() => {
    if (pendingFormId === undefined || known.pending || seededFor.current === pendingFormId) return
    seededFor.current = pendingFormId
    setMapping(identityDraft(streamFields, known.fields))
  }, [pendingFormId, known.pending, known.fields, streamFields])

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
      toast.success(`${pendingForm?.name ?? "Form"} attached.`, {
        description: streamFields.length === 0 ? "Its fields are now the Stream's shape." : undefined,
      })
      setPendingFormId(undefined)
      setMapping({})
      setServerMissing([])
      seededFor.current = undefined
    } catch (error) {
      if (error instanceof PostbagApiError) {
        const details = error.details as { readonly missing?: readonly string[] } | undefined
        setServerMissing(details?.missing ?? [])
      }
      toastAttachError(error, pendingForm?.name)
    }
  }

  if (attachable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Every Form you have is already in this Stream.{" "}
        <Link to="/forms" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create another form
        </Link>{" "}
        to add one.
      </p>
    )
  }

  const matched = streamFields.filter((f) => mapping[f] !== undefined).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={pendingFormId ?? ""} onValueChange={selectForm}>
          <SelectTrigger className="w-64" aria-label="Form to attach">
            <SelectValue placeholder="Attach another form…" />
          </SelectTrigger>
          <SelectContent>
            {attachable.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={pendingFormId === undefined ? "outline" : "default"}
          className="gap-1.5"
          disabled={pendingFormId === undefined || addSource.isPending}
          onClick={() => void attach()}
        >
          <Plus className="size-4" />
          {addSource.isPending ? "Attaching…" : "Attach form"}
        </Button>
      </div>

      {pendingFormId !== undefined && streamFields.length === 0 && (
        <p className="text-xs text-muted-foreground">This is the Stream's first Form, so its fields become the Stream's shape — nothing to match yet.</p>
      )}

      {pendingFormId !== undefined && streamFields.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Match {pendingForm?.name ?? "this form"}'s fields to the shape</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {matched} of {streamFields.length} matched
                {known.pending ? " · reading the form's fields…" : ""}
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-pretty">
              Same-named fields are matched already. Required fields need something pointing at them before the form can join; optional
              ones can stay unmatched and simply arrive empty.
            </p>
            <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
              {streamFields.map((field) => {
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
                          aria-label={`Fixed value for ${field}`}
                          onChange={(e) => {
                            setMapping((m) => ({ ...m, [field]: { const: e.target.value } }))
                          }}
                        />
                      )}
                      <Select value={current} onValueChange={(v) => { onSelect(field, v) }}>
                        <SelectTrigger className="h-8 w-48" aria-label={`Source for ${field}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNMAPPED}>Leave empty</SelectItem>
                          <SelectItem value={CONST}>Fixed value</SelectItem>
                          {known.fields.map((f) => (
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
    </div>
  )
}

function PreviewTab({
  streamId,
  sources,
  formsById,
}: {
  readonly streamId: string
  readonly sources: readonly Source[]
  readonly formsById: ReadonlyMap<string, string>
}) {
  const [formId, setFormId] = useState<string | undefined>(sources[0]?.form_id)
  const submissions = useFormSubmissions(formId)
  const [submissionId, setSubmissionId] = useState<string | undefined>(undefined)
  const preview = useStreamPreview(streamId)

  async function run() {
    if (formId === undefined || submissionId === undefined) return
    const submission = submissions.data?.data.find((s) => s.id === submissionId)
    if (submission === undefined) return
    try {
      await preview.mutateAsync({ formId, data: submission.data })
    } catch (error) {
      toastApiError(error, "Couldn't run the preview — try again.")
    }
  }

  if (sources.length === 0) {
    return <EmptyState title="Nothing to preview yet" description="Attach a Form under Sources first — preview maps one of its real Submissions through the Stream." />
  }

  const recent = submissions.data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={formId ?? ""}
          onValueChange={(v) => {
            setFormId(v)
            setSubmissionId(undefined)
          }}
        >
          <SelectTrigger className="w-64 [&>span]:truncate" aria-label="Form">
            <SelectValue placeholder="Choose a form" />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.form_id} value={s.form_id}>
                {formsById.get(s.form_id) ?? s.form_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={submissionId ?? ""} onValueChange={setSubmissionId} disabled={recent.length === 0}>
          <SelectTrigger className="w-80 [&>span]:truncate" aria-label="Submission">
            <SelectValue placeholder={submissions.isPending ? "Loading submissions…" : recent.length === 0 ? "No submissions on this form yet" : "Choose a recent submission"} />
          </SelectTrigger>
          <SelectContent>
            {recent.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="font-mono text-xs">{s.id}</span> · {formatDateTime(s.received_at)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => void run()} disabled={submissionId === undefined || preview.isPending}>
          {preview.isPending ? "Mapping…" : "Show what would be delivered"}
        </Button>
      </div>

      {preview.data !== undefined && (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-1 duration-(--duration-fast)">
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
            <p className="text-xs text-muted-foreground">This is the payload a destination would receive.</p>
            <pre className="overflow-auto rounded-lg border border-border/70 bg-muted/50 p-4 font-mono text-[13px]">
              <code>{JSON.stringify(preview.data.payload, null, 2)}</code>
            </pre>
            {Object.keys(preview.data.extras).length > 0 && (
              <p className="text-xs text-muted-foreground">
                Fields the form sent that aren't in the shape travel along under <span className="font-mono">extras</span>:{" "}
                <span className="font-mono">{Object.keys(preview.data.extras).join(", ")}</span>.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
