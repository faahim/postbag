import { createFileRoute } from "@tanstack/react-router"

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Events</h1>
        <p className="text-sm text-muted-foreground">Everything that happened, most recent first.</p>
      </div>

      {events.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : events.data === undefined || events.data.data.length === 0 ? (
        <EmptyState title="No events yet" description="Every submission, delivery and change to your workspace shows up here." />
      ) : (
        <ol className="flex flex-col">
          {events.data.data.map((event, i) => (
            <li
              key={event.id}
              className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0 animate-in fade-in-0"
              style={{ animationDelay: `${Math.min(i, 10) * 25}ms`, animationDuration: "var(--duration-fast)" }}
            >
              <Badge variant={typeVariant(event.type)} className="shrink-0 font-mono">
                {event.type}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {Object.entries(event.subject)
                  .map(([k, v]) => `${k}=${String(v)}`)
                  .join(" ")}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatDateTime(event.created_at)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
