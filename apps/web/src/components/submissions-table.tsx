import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/empty-state"
import { formatRelativeTime } from "@/lib/format"

export type SubmissionRow = {
  readonly id: string
  readonly form_id: string
  readonly status: "received" | "quarantined" | "spam"
  readonly test: boolean
  readonly data: Readonly<Record<string, unknown>>
  readonly received_at: string
}

const STATUS_VARIANT = {
  received: "success",
  quarantined: "warning",
  spam: "destructive",
} as const

function preview(data: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(data).filter(([key]) => !key.startsWith("_"))
  if (entries.length === 0) return "—"
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ")
}

export function SubmissionsTable({
  rows,
  isLoading,
  onOpen,
  showFormId = false,
  emptyTitle = "No submissions yet",
  emptyDescription = "Once your form receives a submission, it shows up here instantly.",
}: {
  readonly rows: readonly SubmissionRow[]
  readonly isLoading: boolean
  readonly onOpen: (id: string) => void
  readonly showFormId?: boolean
  readonly emptyTitle?: string
  readonly emptyDescription?: string
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          {showFormId && <TableHead>Form</TableHead>}
          <TableHead>Fields</TableHead>
          <TableHead className="text-right">Received</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow
            key={row.id}
            onClick={() => {
              onOpen(row.id)
            }}
            className="cursor-pointer animate-in fade-in-0 slide-in-from-bottom-0.5"
            style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationDuration: "var(--duration-fast)" }}
          >
            <TableCell>
              <div className="flex items-center gap-1.5">
                <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                {row.test && <Badge variant="muted">test</Badge>}
              </div>
            </TableCell>
            {showFormId && <TableCell className="font-mono text-xs text-muted-foreground">{row.form_id}</TableCell>}
            <TableCell className="max-w-md truncate text-sm text-foreground">{preview(row.data)}</TableCell>
            <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{formatRelativeTime(row.received_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
