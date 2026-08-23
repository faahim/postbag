import { RoutingMark, type RoutingMarkStatus } from "@/components/routing-mark"
import { cn } from "@/lib/utils"

const LABEL: Record<RoutingMarkStatus, string> = {
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
  readonly status: RoutingMarkStatus
  readonly className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", className)}>
      <RoutingMark status={status} size={16} />
      {LABEL[status]}
    </span>
  )
}
