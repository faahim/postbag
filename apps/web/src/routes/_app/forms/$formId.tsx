import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { AlertTriangle, ArrowLeft, Plus, Sparkles, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { CopyButton } from "@/components/copy-button"
import { EmbedSnippetTabs } from "@/components/embed-snippets"
import { RoutesList } from "@/components/routes-list"
import { SubmissionDrawer } from "@/components/submission-drawer"
import { SubmissionsTable } from "@/components/submissions-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, toastApiError } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import { useForm, useFormDrift, useFormEmbed, useFormSchema, usePublishFormSchema, useUpdateForm, useFormSchemaVersions } from "@/lib/queries/forms"
import { buildEditedSchema, editableFieldsFromSchema, isEditableFieldName, retainUiHints, type EditableField, type EditableFieldType } from "@/lib/schema-editing"
import { useFormSubmissions } from "@/lib/queries/submissions"

const TAB_VALUES = ["inbox", "embed", "fields", "send-to", "settings"] as const
type TabValue = (typeof TAB_VALUES)[number]
const searchSchema = z.object({
  tab: z.enum(TAB_VALUES).optional(),
})

export const Route = createFileRoute("/_app/forms/$formId")({
  component: FormDetailRoute,
  validateSearch: searchSchema,
})

function FormDetailRoute() {
  const { formId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const form = useForm(formId)
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null)

  if (form.isLoading || form.data === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="page-enter flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          to="/forms"
          className="group flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-(--duration-quick) hover:text-foreground"
        >
          <ArrowLeft className="size-3.5 transition-transform duration-(--duration-quick) ease-(--ease-smooth-out) group-hover:-translate-x-0.5" /> Forms
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{form.data.name}</h1>
          <Badge variant={form.data.status === "active" ? "success" : "muted"}>{form.data.status}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <code className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-muted-foreground">{form.data.submit_url}</code>
          <CopyButton value={form.data.submit_url} label="Copy URL" />
        </div>
      </div>

      <Tabs
        value={search.tab ?? "inbox"}
        onValueChange={(tab) => {
          void navigate({
            to: "/forms/$formId",
            params: { formId },
            search: { tab: tab as TabValue },
          })
        }}
      >
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="send-to">Send to</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <InboxTab formId={formId} onOpen={setOpenSubmissionId} />
        </TabsContent>
        <TabsContent value="embed">
          <EmbedTab formId={formId} />
        </TabsContent>
        <TabsContent value="fields">
          <FieldsTab formId={formId} />
        </TabsContent>
        <TabsContent value="send-to">
          <RoutesList subject={{ formId }} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab formId={formId} settings={form.data.settings} status={form.data.status} />
        </TabsContent>
      </Tabs>

      <SubmissionDrawer
        submissionId={openSubmissionId}
        onOpenChange={(open) => {
          if (!open) setOpenSubmissionId(null)
        }}
      />
    </div>
  )
}

function InboxTab({ formId, onOpen }: { readonly formId: string; readonly onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("")
  const submissions = useFormSubmissions(formId, { poll: true })
  const rows = (submissions.data?.data ?? []).filter((s) => {
    if (query.trim() === "") return true
    return JSON.stringify(s.data).toLowerCase().includes(query.toLowerCase())
  })

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search submissions…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
        }}
        className="max-w-xs"
      />
      <SubmissionsTable rows={rows} isLoading={submissions.isLoading} onOpen={onOpen} />
    </div>
  )
}

function EmbedTab({ formId }: { readonly formId: string }) {
  const embed = useFormEmbed(formId)
  if (embed.isLoading || embed.data === undefined) return <Skeleton className="h-64 w-full" />
  return <EmbedSnippetTabs embed={embed.data} />
}

function FieldsTab({ formId }: { readonly formId: string }) {
  const schema = useFormSchema(formId)
  const versions = useFormSchemaVersions(formId)
  const drift = useFormDrift(formId)
  const publish = usePublishFormSchema(formId)

  async function publishWhatWereSeeing() {
    if (!schema.isSuccess || drift.data === undefined || drift.data.length === 0) return
    const current = schema.data?.json_schema as Readonly<Record<string, unknown>> | undefined
    const currentUi = schema.data?.ui as Readonly<Record<string, unknown>> | undefined
    const properties: Record<string, unknown> = {
      ...((current?.["properties"] as Record<string, unknown> | undefined) ?? {}),
    }
    let required: string[] = [...((current?.["required"] as readonly string[] | undefined) ?? [])]
    for (const event of drift.data) {
      if (event.kind === "missing_field") {
        required = required.filter((f) => f !== event.field)
      } else if (!Object.hasOwn(properties, event.field)) {
        properties[event.field] = { type: "string" }
      }
    }
    await publish.mutateAsync({
      json_schema: {
        ...current,
        $schema: current?.["$schema"] ?? "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties,
        required,
        additionalProperties: current?.["additionalProperties"] ?? true,
      },
      ...(currentUi === undefined ? {} : { ui: currentUi }),
      changelog: "Published what we're seeing (drift resolution).",
    })
    toast.success("Schema published.")
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Fields</h3>
            <p className="text-sm text-muted-foreground">
              {schema.isError
                ? "The current Schema could not be loaded. Editing stays locked so an existing shape is never replaced by accident."
                : schema.data == null
                  ? "No declared schema yet — this Form accepts anything (observe mode). Add fields and publish to declare its shape."
                  : "Edit and publish — a new immutable version each time; older Submissions keep the shape they arrived with."}
            </p>
          </div>
          {schema.isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : schema.isError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">Nothing can be edited until the current Schema is available.</p>
              <Button
                variant="outline"
                size="sm"
                disabled={schema.isFetching}
                onClick={() => {
                  void schema.refetch()
                }}
              >
                {schema.isFetching ? "Trying again…" : "Try again"}
              </Button>
            </div>
          ) : (
            <FormFieldsEditor key={schema.data?.version ?? 0} schema={schema.data ?? undefined} publish={publish} />
          )}
        </CardContent>
      </Card>

      {versions.data !== undefined && versions.data.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Version history</h3>
            <ol className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
              {[...versions.data]
                .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
                .map((v) => {
                  const fieldCount = Object.keys((v.json_schema as { properties?: Record<string, unknown> }).properties ?? {}).length
                  const current = v.version === schema.data?.version
                  return (
                    <li key={v.version ?? v.created_at} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-xs tabular-nums">v{v.version}</span>
                        {current && <Badge variant="outline">current</Badge>}
                        {v.inferred === true && <Badge variant="muted">inferred</Badge>}
                        <span className="truncate text-muted-foreground">{v.changelog ?? `${fieldCount} ${fieldCount === 1 ? "field" : "fields"}`}</span>
                      </div>
                      {v.created_at !== undefined && <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(v.created_at)}</span>}
                    </li>
                  )
                })}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">Versions are never edited in place — publishing always adds the next one.</p>
          </CardContent>
        </Card>
      )}

      {drift.data !== undefined && drift.data.length > 0 && (
        <Card className="border-warning/40">
          <CardContent>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <AlertTriangle className="size-4 text-warning-foreground" />
                Change detected
              </h3>
              <Button size="sm" onClick={() => void publishWhatWereSeeing()} disabled={!schema.isSuccess || publish.isPending} className="gap-1.5">
                <Sparkles className="size-3.5" />
                Publish what we're seeing
              </Button>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {drift.data.map((event) => (
                <li key={event.id} className="font-mono text-xs">
                  {event.kind}: <span className="text-foreground">{event.field}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

type FieldType = EditableFieldType
type FieldsSchema = {
  readonly version?: number
  readonly json_schema: unknown
  readonly ui?: unknown
}
type FieldRow = EditableField

const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  string: "Text",
  number: "Number",
  boolean: "Yes / no",
  other: "As published",
}

function fieldsFromFormSchema(schema: FieldsSchema | undefined): FieldRow[] {
  return editableFieldsFromSchema(
    schema?.json_schema as Readonly<Record<string, unknown>> | undefined,
    schema?.ui as Readonly<Record<string, unknown>> | undefined,
  )
}

/** The Form's declared fields as an editable list — publishing always creates the
 * next immutable version (Golden rule 5), never edits one in place. */
function FormFieldsEditor({ schema, publish }: { readonly schema: FieldsSchema | undefined; readonly publish: ReturnType<typeof usePublishFormSchema> }) {
  const previous = schema?.json_schema as Readonly<Record<string, unknown>> | undefined
  const previousUi = schema?.ui as Readonly<Record<string, unknown>> | undefined
  const [fields, setFields] = useState<FieldRow[]>(() => fieldsFromFormSchema(schema))
  const [newName, setNewName] = useState("")
  const [nameError, setNameError] = useState<string | undefined>(undefined)

  const draft = buildEditedSchema(fields, previous)
  const dirty = schema === undefined ? fields.length > 0 : JSON.stringify(draft) !== JSON.stringify(buildEditedSchema(fieldsFromFormSchema(schema), previous))
  const nextVersion = (schema?.version ?? 0) + 1

  function addField(event: { preventDefault: () => void }) {
    event.preventDefault()
    const name = newName.trim()
    if (name.length === 0) return
    if (!isEditableFieldName(name)) {
      setNameError("Use letters, numbers, _ or -; dots are reserved for nested paths.")
      return
    }
    if (fields.some((f) => f.name === name)) {
      setNameError("That field is already declared.")
      return
    }
    setFields((current) => [...current, { name, type: "string", required: false }])
    setNewName("")
    setNameError(undefined)
  }

  async function publishFields() {
    try {
      const keptUi = retainUiHints(previousUi, fields)
      await publish.mutateAsync({
        json_schema: draft,
        ...(keptUi === undefined ? {} : { ui: keptUi }),
        changelog: `Version ${nextVersion.toString()} — edited in the dashboard.`,
      })
      toast.success(`Version ${nextVersion.toString()} published.`)
    } catch (error) {
      toastApiError(error, "Couldn't publish the fields — try again.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.length > 0 && (
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
          {fields.map((field) => (
            <li key={field.name} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-sm">{field.name}</span>
              <Select
                value={field.type}
                onValueChange={(value) => {
                  setFields((current) => current.map((f) => (f.name === field.name ? { ...f, type: value as FieldType } : f)))
                }}
              >
                <SelectTrigger className="h-8 w-36 text-xs" aria-label={`Type of ${field.name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FIELD_TYPE_LABEL) as FieldType[])
                    .filter((t) => t !== "other" || field.original !== undefined)
                    .map((t) => (
                      <SelectItem key={t} value={t}>
                        {FIELD_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={field.required}
                  onCheckedChange={(checked) => {
                    setFields((current) => current.map((f) => (f.name === field.name ? { ...f, required: checked === true } : f)))
                  }}
                  aria-label={`${field.name} required`}
                />
                required
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label={`Remove ${field.name}`}
                onClick={() => {
                  setFields((current) => current.filter((f) => f.name !== field.name))
                }}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addField} className="flex items-start gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              setNameError(undefined)
            }}
            placeholder="Add a field, e.g. email"
            aria-label="New field name"
            aria-invalid={nameError !== undefined}
          />
          {nameError !== undefined && <p className="text-xs text-destructive">{nameError}</p>}
        </div>
        <Button type="submit" variant="outline" disabled={newName.trim().length === 0}>
          <Plus /> Add field
        </Button>
      </form>

      {dirty && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-accent/40 px-4 py-3">
          <p className="text-sm text-accent-foreground">Unpublished changes — Submissions are checked against the published version only.</p>
          <Button size="sm" onClick={() => void publishFields()} disabled={publish.isPending}>
            {publish.isPending ? "Publishing…" : `Publish v${nextVersion.toString()}`}
          </Button>
        </div>
      )}
    </div>
  )
}

function SettingsTab({
  formId,
  settings,
  status,
}: {
  readonly formId: string
  readonly settings: Readonly<Record<string, unknown>>
  readonly status: "active" | "paused"
}) {
  const navigate = useNavigate()
  const updateForm = useUpdateForm(formId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [origins, setOrigins] = useState(Array.isArray(settings["allowed_origins"]) ? (settings["allowed_origins"] as string[]).join(", ") : "")
  const [redirectUrl, setRedirectUrl] = useState(typeof settings["redirect_url"] === "string" ? settings["redirect_url"] : "")
  const [honeypot, setHoneypot] = useState(typeof settings["honeypot_field"] === "string" ? settings["honeypot_field"] : "_gotcha")
  const [replyTo, setReplyTo] = useState(typeof settings["reply_to_field"] === "string" ? settings["reply_to_field"] : "")

  async function save() {
    await updateForm.mutateAsync({
      settings: {
        allowed_origins: origins
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
        redirect_url: redirectUrl === "" ? null : redirectUrl,
        honeypot_field: honeypot,
        reply_to_field: replyTo === "" ? null : replyTo,
      },
    })
    toast.success("Settings saved.")
  }

  async function deleteForm() {
    await api.DELETE("/v1/forms/{formId}", { params: { path: { formId } } })
    toast.success("Form deleted.")
    await navigate({ to: "/forms" })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Pause this Form</Label>
              <p className="text-xs text-muted-foreground">A paused Form stores every Submission but never delivers one.</p>
            </div>
            <Switch
              checked={status === "paused"}
              onCheckedChange={(checked) => {
                void updateForm.mutateAsync({ status: checked ? "paused" : "active" })
              }}
            />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="origins">Allowed origins</Label>
            <Input
              id="origins"
              value={origins}
              onChange={(e) => {
                setOrigins(e.target.value)
              }}
              placeholder="https://example.com, https://www.example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="redirect">Redirect URL</Label>
            <Input
              id="redirect"
              value={redirectUrl}
              onChange={(e) => {
                setRedirectUrl(e.target.value)
              }}
              placeholder="https://example.com/thanks"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="honeypot">Honeypot field</Label>
            <Input
              id="honeypot"
              value={honeypot}
              onChange={(e) => {
                setHoneypot(e.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reply-to">Reply-to field</Label>
            <Input
              id="reply-to"
              value={replyTo}
              onChange={(e) => {
                setReplyTo(e.target.value)
              }}
              placeholder="email"
            />
          </div>
          <Button className="self-start" onClick={() => void save()} disabled={updateForm.isPending}>
            {updateForm.isPending ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardContent className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-destructive">Danger zone</h3>
            <p className="text-xs text-muted-foreground">Deletes the Form and stops it from accepting Submissions.</p>
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              setConfirmDelete(true)
            }}
          >
            Delete Form
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this Form?"
        description="Its Submissions are kept in the record, but the URL stops accepting new ones — anything your site posts here afterwards is turned away."
        confirmLabel="Delete Form"
        onConfirm={() => void deleteForm()}
      />
    </div>
  )
}
