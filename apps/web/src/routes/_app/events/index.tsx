import { createFileRoute } from "@tanstack/react-router"
import type { CSSProperties } from "react"

import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime } from "@/lib/format"
import { useEvents } from "@/lib/queries/events"

export const Route = createFileRoute("/_app/events/")({
  component: EventsRoute,
})

function typeVariant(type: string): "success" | "destructive" | "warning" | "outline" {
  if (type.includes("fail") || type.includes("dead") || type.includes("spam")) return "destructive"
  if (type.includes("sent") || type.includes("created")) return "success"
  if (type.includes("drift") || type.includes("quarantine")) return "warning"
  return "outline"
}

function EventsRoute() {
  const events = useEvents()

  return (
    <div className="flex flex-col gap-8">
      {events.isLoading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : events.data === undefined || events.data.data.length === 0 ? (
        <EmptyState
          title="Quiet so far"
          description="Every Submission, Delivery and change to this workspace lands in this log — and an event webhook can push each one to you as it happens."
        />
      ) : (
        <div className="list-surface">
          <ol className="flex flex-col divide-y divide-border/60">
            {events.data.data.map((event, i) => (
              <li
                key={event.id}
                className="row-enter flex items-center gap-4 px-5 py-3.5"
                style={{ "--row-index": i } as CSSProperties}
              >
                <Badge variant={typeVariant(event.type)} className="shrink-0 font-mono">
                  {event.type}
                </Badge>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                  {Object.entries(event.subject)
                    .map(([k, v]) => `${k}=${String(v)}`)
                    .join("  ")}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{formatDateTime(event.created_at)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
