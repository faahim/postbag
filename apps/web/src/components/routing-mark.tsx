import { cn } from "@/lib/utils"

export type RoutingMarkStatus = "sent" | "failed" | "dead" | "pending" | "skipped"

const STATUS_LABEL: Record<RoutingMarkStatus, string> = {
  sent: "Sent",
  failed: "Failed",
  dead: "Dead",
  pending: "Pending",
  skipped: "Skipped",
}

const STATUS_COLOR: Record<RoutingMarkStatus, string> = {
  sent: "text-success",
  failed: "text-warning-foreground",
  dead: "text-destructive",
  pending: "text-muted-foreground",
  skipped: "text-muted-foreground",
}

export type RoutingMarkProps = {
  readonly status: RoutingMarkStatus
  readonly size?: number
  readonly className?: string
  readonly title?: string
  readonly tone?: "status" | "accent"
}

/** Compact receiving/routing mark. It replaces the old circular check stamp. */
export function RoutingMark({ status, size = 20, className, title, tone = "status" }: RoutingMarkProps) {
  const pending = status === "pending" || status === "skipped"

  return (
    <svg
      role="img"
      aria-label={title ?? STATUS_LABEL[status]}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn(tone === "accent" ? "text-primary" : STATUS_COLOR[status], className)}
      fill="none"
    >
      {title !== undefined && <title>{title}</title>}
      <path d="M8.5 5.5h11a2 2 0 0 1 2 2v11h-15v-11a2 2 0 0 1 2-2Z" fill="currentColor" opacity={pending ? 0.05 : 0.09} />
      <path d="M11.5 8h11a2 2 0 0 1 2 2v10h-15V10a2 2 0 0 1 2-2Z" fill="currentColor" opacity={pending ? 0.08 : 0.15} />
      <path
        d="M5 17h5.2l2.6 2.7h6.4l2.6-2.7H27v8.3a2.7 2.7 0 0 1-2.7 2.7H7.7A2.7 2.7 0 0 1 5 25.3V17Z"
        fill="currentColor"
        opacity={pending ? 0.1 : 0.16}
      />
      <path
        d="M5 17h5.2l2.6 2.7h6.4l2.6-2.7H27v8.3a2.7 2.7 0 0 1-2.7 2.7H7.7A2.7 2.7 0 0 1 5 25.3V17Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
        opacity={pending ? 0.48 : 0.9}
      />
      {status === "sent" ? (
        <g stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.5 24h7v-4" />
          <path d="m22.3 21.7 2.2-2.2 2.2 2.2" />
        </g>
      ) : status === "failed" ? (
        <g stroke="currentColor" strokeWidth="1.55" strokeLinecap="round">
          <path d="M17.5 24h3.2" />
          <path d="M23.8 24H27" opacity="0.6" />
        </g>
      ) : status === "dead" ? (
        <path d="m20 21.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      ) : status === "skipped" ? (
        <path d="M18.5 24H26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      ) : (
        <path d="M18 24h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1.7 2.8" opacity="0.55" />
      )}
    </svg>
  )
}
