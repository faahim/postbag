import { AlertTriangle, ShieldCheck, ShieldOff } from "lucide-react"
import { toast } from "sonner"

import { DeliveryStatusBadge } from "@/components/delivery-status"
import type { PostmarkStatus } from "@/components/postmark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime, formatRelativeTime, splitPrefixedId } from "@/lib/format"
import type { Delivery } from "@/lib/queries/deliveries"
import { useSubmission, useUpdateSubmissionStatus, type SubmissionDetail } from "@/lib/queries/submissions"

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
            <SubmissionDetailBody submission={submission} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SubmissionDetailBody({ submission }: { readonly submission: SubmissionDetail }) {
  const updateStatus = useUpdateSubmissionStatus()
  const deliveries: readonly Delivery[] = submission.deliveries ?? []

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
          <ul className="flex flex-col gap-3">
            {deliveries.map((delivery) => (
              <li key={delivery.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {Object.keys(submission.meta).length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Meta</h3>
          <dl className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
            {Object.entries(submission.meta).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="shrink-0">{key}:</dt>
                <dd className="truncate">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <Separator />

      <div className="flex justify-end gap-2">
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
  )
}
