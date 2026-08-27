import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"

import { PageHeader } from "@/components/page-header"
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

  const formNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const form of forms.data?.data ?? []) map[form.id] = form.name
    return map
  }, [forms.data])

  const filtered = formId !== undefined || streamId !== undefined || status !== undefined || query.trim() !== ""

  return (
    <div className="page-enter flex flex-col gap-8">
      <PageHeader title="Inbox" description="Every Submission across the workspace, the moment it lands." />

      <div className="flex flex-wrap items-center gap-2.5">
        <Input
          placeholder="Search…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          className="w-64"
        />
        <Select value={formId ?? "all"} onValueChange={(v) => { setFormId(v === "all" ? undefined : v) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Forms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Forms</SelectItem>
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

      <InboxTable formId={formId} query={query} streamId={streamId} status={status} formNames={formNames} filtered={filtered} />
    </div>
  )
}

function InboxTable({
  formId,
  streamId,
  status,
  query,
  formNames,
  filtered,
}: {
  readonly formId?: string | undefined
  readonly streamId?: string | undefined
  readonly status?: string | undefined
  readonly query: string
  readonly formNames: Readonly<Record<string, string>>
  readonly filtered: boolean
}) {
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null)
  const submissions = useSubmissions({ form: formId, stream: streamId, status, q: query.trim() === "" ? undefined : query })

  return (
    <>
      <SubmissionsTable
        rows={submissions.data?.data ?? []}
        isLoading={submissions.isLoading}
        onOpen={setOpenSubmissionId}
        formNames={formNames}
        emptyBrandMark={!filtered}
        emptyTitle={filtered ? "Nothing matches these filters" : "Nothing has landed yet"}
        emptyDescription={
          filtered
            ? "No Submission fits this combination. Loosen a filter and they'll come back."
            : "The moment a Submission arrives, it settles here — saved before it goes anywhere else."
        }
      />
      <SubmissionDrawer submissionId={openSubmissionId} onOpenChange={(open) => { if (!open) setOpenSubmissionId(null) }} />
    </>
  )
}
