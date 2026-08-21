import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { AlertTriangle, ArrowLeft, Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { EmbedSnippetTabs } from "@/components/embed-snippets"
import { RoutesList } from "@/components/routes-list"
import { SubmissionDrawer } from "@/components/submission-drawer"
import { SubmissionsTable } from "@/components/submissions-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import {
  useForm,
  useFormDrift,
  useFormEmbed,
  useFormSchema,
  usePublishFormSchema,
  useUpdateForm,
  useFormSchemaVersions,
} from "@/lib/queries/forms"
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link to="/forms" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Forms
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{form.data.name}</h1>
          <Badge variant={form.data.status === "active" ? "success" : "muted"}>{form.data.status}</Badge>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{form.data.submit_url}</p>
      </div>

      <Tabs
        value={search.tab ?? "inbox"}
        onValueChange={(tab) => {
          void navigate({ to: "/forms/$formId", params: { formId }, search: { tab: tab as TabValue } })
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

      <SubmissionDrawer submissionId={openSubmissionId} onOpenChange={(open) => { if (!open) setOpenSubmissionId(null) }} />
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
    if (drift.data === undefined || drift.data.length === 0) return
    const current = schema.data?.json_schema as { properties?: Record<string, unknown>; required?: string[] } | undefined
    const properties: Record<string, unknown> = { ...(current?.properties ?? {}) }
    let required: string[] = [...(current?.required ?? [])]
    for (const event of drift.data) {
      if (event.kind === "missing_field") {
        required = required.filter((f) => f !== event.field)
      } else if (!Object.hasOwn(properties, event.field)) {
        properties[event.field] = { type: "string" }
      }
    }
    await publish.mutateAsync({
      json_schema: { type: "object", properties, required },
      changelog: "Published what we're seeing (drift resolution).",
    })
    toast.success("Schema published.")
  }

  const properties = (schema.data?.json_schema as { properties?: Record<string, unknown>; required?: string[] } | undefined)?.properties ?? {}
  const required = (schema.data?.json_schema as { properties?: Record<string, unknown>; required?: string[] } | undefined)?.required ?? []

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Current fields</h3>
          {Object.keys(properties).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No declared schema yet — this form accepts anything (observe mode). Fields appear here once you publish a
              schema.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
              {Object.entries(properties).map(([name, def]) => (
                <li key={name} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-mono">{name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {(def as { type?: string }).type ?? "any"}
                    {required.includes(name) && <Badge variant="outline">required</Badge>}
                  </span>
                </li>
              ))}
            </ul>
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
                    <li key={v.version ?? v.created_at} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
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
              <Button size="sm" onClick={() => void publishWhatWereSeeing()} disabled={publish.isPending} className="gap-1.5">
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
  const [origins, setOrigins] = useState(
    Array.isArray(settings["allowed_origins"]) ? (settings["allowed_origins"] as string[]).join(", ") : "",
  )
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
    if (!window.confirm("Delete this form permanently? Submissions are kept, but the endpoint stops accepting new ones.")) return
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
              <Label>Pause this form</Label>
              <p className="text-xs text-muted-foreground">Paused forms store submissions but never deliver them.</p>
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
            <Input id="origins" value={origins} onChange={(e) => { setOrigins(e.target.value) }} placeholder="https://example.com, https://www.example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="redirect">Redirect URL</Label>
            <Input id="redirect" value={redirectUrl} onChange={(e) => { setRedirectUrl(e.target.value) }} placeholder="https://example.com/thanks" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="honeypot">Honeypot field</Label>
            <Input id="honeypot" value={honeypot} onChange={(e) => { setHoneypot(e.target.value) }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reply-to">Reply-to field</Label>
            <Input id="reply-to" value={replyTo} onChange={(e) => { setReplyTo(e.target.value) }} placeholder="email" />
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
            <p className="text-xs text-muted-foreground">Deletes the form and stops it from accepting submissions.</p>
          </div>
          <Button variant="destructive" onClick={() => void deleteForm()}>
            Delete form
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
