import { Postmark, type PostmarkStatus } from "@/components/postmark"
import { cn } from "@/lib/utils"

const LABEL: Record<PostmarkStatus, string> = {
  sent: "Sent",
  failed: "Retrying",
  dead: "Dead",
  pending: "Pending",
  skipped: "Skipped",
}

export function DeliveryStatusBadge({
  status,
  className,
}: {
  readonly status: PostmarkStatus
  readonly className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", className)}>
      <Postmark status={status} size={16} />
      {LABEL[status]}
    </span>
  )
}
