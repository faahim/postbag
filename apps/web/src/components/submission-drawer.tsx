import { AlertTriangle, ChevronDown, ShieldCheck, ShieldOff, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { DeliveryStatusBadge } from "@/components/delivery-status"
import { Postmark, type PostmarkStatus } from "@/components/postmark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime, formatRelativeTime, splitPrefixedId } from "@/lib/format"
import { toastApiError } from "@/lib/api"
import type { Delivery } from "@/lib/queries/deliveries"
import { type SubmissionDetail, useDeleteSubmission, useSubmission, useUpdateSubmissionStatus } from "@/lib/queries/submissions"

// A switch (rather than an object-literal lookup) so narrowing stays reliable even
// though `status` comes off `SubmissionDetail`, an intersection type.
function statusVariant(status: "received" | "quarantined" | "spam"): "success" | "warning" | "destructive" {
  switch (status) {
    case "received":
      return "success"
    case "quarantined":
      return "warning"
    case "spam":
      return "destructive"
  }
}

export function SubmissionDrawer({
  submissionId,
  onOpenChange,
}: {
  readonly submissionId: string | null
  readonly onOpenChange: (open: boolean) => void
}) {
  const { data: submission, isLoading } = useSubmission(submissionId ?? undefined)
  const idParts = submission !== undefined ? splitPrefixedId(submission.id) : null

  return (
    <Sheet open={submissionId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-mono text-base">
            {idParts !== null && (
              <>
                <span className="text-muted-foreground">{idParts.prefix}</span>
                {idParts.rest}
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            {submission !== undefined ? `Received ${formatDateTime(submission.received_at)}` : "Loading submission…"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading || submission === undefined ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <SubmissionDetailBody
              submission={submission}
              onDeleted={() => {
                onOpenChange(false)
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SubmissionDetailBody({ submission, onDeleted }: { readonly submission: SubmissionDetail; readonly onDeleted: () => void }) {
  const updateStatus = useUpdateSubmissionStatus()
  const deleteSubmission = useDeleteSubmission()
  const deliveries: readonly Delivery[] = submission.deliveries ?? []

  async function remove() {
    if (!window.confirm("Delete this submission permanently? This is the one thing Postbag never does on its own — it can't be undone.")) return
    try {
      await deleteSubmission.mutateAsync(submission.id)
      toast.success("Submission deleted.")
      onDeleted()
    } catch (error) {
      toastApiError(error, "Couldn't delete the submission — try again.")
    }
  }

  async function markSpam() {
    await updateStatus.mutateAsync({ submissionId: submission.id, status: "spam" })
    toast.success("Marked as spam.")
  }

  async function markNotSpam() {
    await updateStatus.mutateAsync({ submissionId: submission.id, status: "received" })
    toast.success("Restored — deliveries have been queued.")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Badge variant={statusVariant(submission.status)}>{submission.status}</Badge>
        {submission.test && <Badge variant="muted">test</Badge>}
        {submission.spam.score > 0 && (
          <Badge variant="outline" className="gap-1">
            <AlertTriangle className="size-3" />
            spam score {submission.spam.score.toFixed(2)}
          </Badge>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Fields</h3>
        <dl className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
          {Object.entries(submission.data).length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No fields.</p>
          ) : (
            Object.entries(submission.data).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-0.5 px-3 py-2.5">
                <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
                <dd className="text-sm break-words text-foreground">{String(value)}</dd>
              </div>
            ))
          )}
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Deliveries</h3>
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No routes matched this submission yet.</p>
        ) : (
          <ul className="flex flex-col">
            {deliveries.map((delivery, i) => (
              <li key={delivery.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < deliveries.length - 1 && (
                  <span aria-hidden className="absolute top-6 bottom-0 left-[9px] w-px bg-border" />
                )}
                <div className="relative z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full bg-card">
                  <Postmark status={delivery.status as PostmarkStatus} size={18} />
                </div>
                <div className="flex flex-1 items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <DeliveryStatusBadge status={delivery.status as PostmarkStatus} />
                    <span className="font-mono text-xs text-muted-foreground">{delivery.destination_id}</span>
                    {delivery.last_error !== null && <span className="text-xs text-destructive">{delivery.last_error}</span>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {delivery.sent_at !== null
                      ? formatRelativeTime(delivery.sent_at)
                      : delivery.next_attempt_at !== null
                        ? `retry ${formatRelativeTime(delivery.next_attempt_at)}`
                        : `${delivery.attempts.toString()} attempts`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {Object.keys(submission.meta).length > 0 && <MetaSection meta={submission.meta} />}

      <Separator />

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => void remove()} disabled={deleteSubmission.isPending}>
          <Trash2 className="size-3.5" /> Delete
        </Button>
        <div className="flex gap-2">
        {submission.status === "spam" ? (
          <Button variant="outline" size="sm" onClick={() => void markNotSpam()} disabled={updateStatus.isPending}>
            <ShieldCheck /> Not spam
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => void markSpam()} disabled={updateStatus.isPending}>
            <ShieldOff /> Mark spam
          </Button>
        )}
        </div>
      </div>
    </div>
  )
}

/** transitions-dev accordion (docs/DESIGN.md §3 motion tokens) — request metadata is
 * useful but secondary, so it starts collapsed and expands without a layout jolt. */
function MetaSection({ meta }: { readonly meta: Readonly<Record<string, unknown>> }) {
  const [open, setOpen] = useState(false)

  return (
    <section className="t-acc flex flex-col gap-2" data-open={open}>
      <button
        type="button"
        className="t-acc-head flex items-center justify-between text-xs font-medium tracking-wide text-muted-foreground uppercase"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v)
        }}
      >
        Meta
        <span className="t-acc-chevron">
          <ChevronDown className="size-3.5" />
        </span>
      </button>
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner">
          <dl className="flex flex-col gap-1 pt-1 font-mono text-xs text-muted-foreground">
            {Object.entries(meta).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="shrink-0">{key}:</dt>
                <dd className="truncate">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
