import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SubmissionDrawer } from "@/components/submission-drawer"
import { SubmissionsTable } from "@/components/submissions-table"
import { useForms } from "@/lib/queries/forms"
import { useSubmissions } from "@/lib/queries/submissions"
import { useStreams } from "@/lib/queries/streams"

export const Route = createFileRoute("/_app/inbox/")({
  component: InboxRoute,
})

function InboxRoute() {
  const [formId, setFormId] = useState<string | undefined>(undefined)
  const [streamId, setStreamId] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState("")

  const forms = useForms()
  const streams = useStreams()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Inbox</h1>
        <p className="text-sm text-muted-foreground">Every submission across the workspace, live.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          className="w-56"
        />
        <Select value={formId ?? "all"} onValueChange={(v) => { setFormId(v === "all" ? undefined : v) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All forms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All forms</SelectItem>
            {(forms.data?.data ?? []).map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {streams.data !== undefined && streams.data.length > 0 && (
          <Select value={streamId ?? "all"} onValueChange={(v) => { setStreamId(v === "all" ? undefined : v) }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Streams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Streams</SelectItem>
              {streams.data.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={status ?? "all"} onValueChange={(v) => { setStatus(v === "all" ? undefined : v) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="quarantined">Quarantined</SelectItem>
            <SelectItem value="spam">Spam</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <InboxTable formId={formId} query={query} streamId={streamId} status={status} />
    </div>
  )
}

function InboxTable({
  formId,
  streamId,
  status,
  query,
}: {
  readonly formId?: string | undefined
  readonly streamId?: string | undefined
  readonly status?: string | undefined
  readonly query: string
}) {
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null)
  const submissions = useSubmissions({ form: formId, stream: streamId, status, q: query.trim() === "" ? undefined : query })

  return (
    <>
      <SubmissionsTable
        rows={submissions.data?.data ?? []}
        isLoading={submissions.isLoading}
        onOpen={setOpenSubmissionId}
        showFormId
        emptyDescription="Nothing matches these filters yet."
      />
      <SubmissionDrawer submissionId={openSubmissionId} onOpenChange={(open) => { if (!open) setOpenSubmissionId(null) }} />
    </>
  )
}
