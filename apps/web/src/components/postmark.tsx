import { cn } from "@/lib/utils"

export type PostmarkStatus = "sent" | "failed" | "dead" | "pending" | "skipped"

const STATUS_LABEL: Record<PostmarkStatus, string> = {
  sent: "Sent",
  failed: "Failed",
  dead: "Dead",
  pending: "Pending",
  skipped: "Skipped",
}

const STATUS_COLOR: Record<PostmarkStatus, string> = {
  sent: "text-success",
  failed: "text-warning-foreground",
  dead: "text-destructive",
  pending: "text-muted-foreground",
  skipped: "text-muted-foreground",
}

// Twelve cancellation lines radiating from the ring, like a postal date stamp.
// "Failed" jitters their angle and opacity a touch — a smudged strike.
const TICKS = Array.from({ length: 12 }, (_, i) => i)

function tickTransform(i: number, status: PostmarkStatus): string {
  const angle = (360 / TICKS.length) * i
  if (status === "failed") {
    const jitter = Math.sin(i * 2.7) * 6
    return `rotate(${(angle + jitter).toFixed(1)})`
  }
  return `rotate(${angle})`
}

export type PostmarkProps = {
  readonly status: PostmarkStatus
  readonly size?: number
  readonly className?: string
  readonly title?: string
  /** "status" (default) colors by delivery outcome — success green, failure red, etc.
   * "accent" forces the wax-seal red regardless of status: reserved for the brand mark
   * (sidebar logo) and hero "your form is live" / "it arrived" moments, where the stamp
   * is identity, not a status readout (docs/DESIGN.md §2, job-E accent presence). */
  readonly tone?: "status" | "accent"
};

/** The Postbag signature motif — a circular postmark "stamp" used for delivery status,
 * empty-state illustrations, and the logo mark. One motif, used consistently. */
export function Postmark({ status, size = 20, className, title, tone = "status" }: PostmarkProps) {
  const isDead = status === "dead"
  const isPending = status === "pending" || status === "skipped"
  const strokeOpacity = status === "failed" ? 0.55 : isPending ? 0.45 : 1

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
      <circle
        cx="16"
        cy="16"
        r="14.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray={isPending ? "2.6 3" : undefined}
        opacity={strokeOpacity}
      />
      <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="1" opacity={strokeOpacity * 0.7} />
      <g opacity={isPending ? 0.35 : strokeOpacity}>
        {TICKS.map((i) => (
          <line
            key={i}
            x1="16"
            y1="2.4"
            x2="16"
            y2="5.6"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            transform={tickTransform(i, status)}
            transformOrigin="16 16"
          />
        ))}
      </g>
      {isDead ? (
        <path d="M11.5 11.5L20.5 20.5M20.5 11.5L11.5 20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : status === "sent" ? (
        <path
          d="M10.5 16.5L14 20L21.5 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : status === "failed" ? (
        <circle cx="16" cy="16" r="2.2" fill="currentColor" opacity="0.8" />
      ) : (
        <circle cx="16" cy="16" r="1.6" fill="currentColor" opacity="0.5" />
      )}
    </svg>
  )
}
