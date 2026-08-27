import type { CSSProperties } from "react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { RoutingMark, type RoutingMarkStatus } from "@/components/routing-mark"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { quarantineReasonDetail } from "@/lib/quarantine"

export type SubmissionRow = {
  readonly id: string
  readonly form_id: string
  readonly status: "received" | "quarantined" | "spam"
  readonly quarantine_reason: string | null
  readonly test: boolean
  readonly data: Readonly<Record<string, unknown>>
  readonly received_at: string
}

// A Submission's status uses the same compact receiving/routing language as a Delivery.
const STATUS_MARK: Record<SubmissionRow["status"], RoutingMarkStatus> = {
  received: "sent",
  quarantined: "pending",
  spam: "dead",
}

const STATUS_APERTURE: Record<SubmissionRow["status"], string> = {
  received: "bg-accent/50",
  quarantined: "bg-warning/15",
  spam: "bg-destructive/10",
}

/** The keys most likely to say who a Submission is from, in order of preference. */
const HEADLINE_KEYS = ["name", "full_name", "contact", "attendee", "company", "email", "subject", "title"] as const

export function headline(data: Readonly<Record<string, unknown>>): string | null {
  for (const key of HEADLINE_KEYS) {
    const value = data[key]
    if (typeof value === "string" && value.trim() !== "") return value
  }
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith("_") && typeof value === "string" && value.trim() !== "") return value
  }
  return null
}

/** Form detail pages omit the label; the workspace Inbox always keeps an id fallback. */
export function formLabel(
  formId: string,
  formNames: Readonly<Record<string, string>> | undefined,
): string | undefined {
  return formNames === undefined ? undefined : (formNames[formId] ?? formId)
}

function preview(data: Readonly<Record<string, unknown>>, skip: string | null): string {
  const entries = Object.entries(data).filter(
    ([key, value]) => !key.startsWith("_") && String(value).trim() !== "" && String(value) !== skip,
  )
  if (entries.length === 0) return "—"
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ")
}

export function SubmissionsTable({
  rows,
  isLoading,
  onOpen,
  formNames,
  emptyTitle = "Nothing has landed yet",
  emptyDescription = "The moment a Submission arrives, it settles here — saved before it goes anywhere else.",
  emptyAction,
  emptyBrandMark = false,
}: {
  readonly rows: readonly SubmissionRow[]
  readonly isLoading: boolean
  readonly onOpen: (id: string) => void
  /** Map of form id → Form name; when present each row names its Form. */
  readonly formNames?: Readonly<Record<string, string>>
  readonly emptyTitle?: string
  readonly emptyDescription?: string
  readonly emptyAction?: React.ReactNode
  readonly emptyBrandMark?: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[4.25rem] w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        brandMark={emptyBrandMark}
      />
    )
  }

  return (
    <div className="list-surface">
      <ul className="divide-y divide-border/60">
        {rows.map((row, i) => {
          const head = headline(row.data)
          const sourceLabel = formLabel(row.form_id, formNames)
          return (
            <li key={row.id} className="row-enter" style={{ "--row-index": i } as CSSProperties}>
              <button
                type="button"
                onClick={() => {
                  onOpen(row.id)
                }}
                className={cn(
                  "group flex w-full items-center gap-4 px-5 py-4 text-left",
                  "transition-colors duration-(--duration-quick) ease-(--ease-smooth-out) hover:bg-muted/40",
                  "outline-none focus-visible:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg shadow-inner",
                    STATUS_APERTURE[row.status],
                  )}
                  aria-hidden="true"
                >
                  <RoutingMark status={STATUS_MARK[row.status]} size={22} />
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[15px] font-medium text-foreground">{head ?? "Empty submission"}</span>
                    {row.status === "spam" && <Badge variant="destructive">spam</Badge>}
                    {row.status === "quarantined" && (
                      <Badge variant="warning">{quarantineReasonDetail(row.quarantine_reason).label}</Badge>
                    )}
                    {row.test && <Badge variant="muted">test</Badge>}
                  </span>
                  <span className="fade-truncate block text-sm text-muted-foreground">{preview(row.data, head)}</span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className="text-sm text-muted-foreground tabular-nums">{formatRelativeTime(row.received_at)}</span>
                  {sourceLabel !== undefined && (
                    <span className="text-xs text-muted-foreground/70">{sourceLabel}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
