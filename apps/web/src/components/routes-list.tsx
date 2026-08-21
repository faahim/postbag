import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { AddRouteDialog, type RouteSubject } from "@/components/add-route-dialog"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { describeDestination } from "@/components/destination-row"
import { Badge } from "@/components/ui/badge"
import { toastApiError } from "@/lib/api"
import { useDestinations } from "@/lib/queries/destinations"
import { useDeleteRoute, useRoutes, useUpdateRoute } from "@/lib/queries/routes"

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

/** "Instant" / "Daily digest · 08:00 Europe/Stockholm" / "Weekly digest · Mon 08:00 …" */
function describeMode(mode: { readonly type: string; readonly cron?: string; readonly timezone?: string }): string {
  if (mode.type !== "digest" || mode.cron === undefined) return "Instant"
  const [minute = "0", hour = "0", , , dow = "*"] = mode.cron.trim().split(/\s+/u)
  const hhmm = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
  const tz = mode.timezone === undefined ? "" : ` ${mode.timezone}`
  if (dow === "*") return `Daily digest · ${hhmm}${tz}`
  const day = WEEKDAY_SHORT[Number(dow)] ?? dow
  return `Weekly digest · ${day} ${hhmm}${tz}`
}

export function RoutesList({ subject }: { readonly subject: RouteSubject }) {
  const routes = useRoutes("formId" in subject ? { form: subject.formId } : { stream: subject.streamId })
  const destinations = useDestinations()
  const updateRoute = useUpdateRoute()
  const deleteRoute = useDeleteRoute()
  const [addOpen, setAddOpen] = useState(false)

  const destinationById = new Map((destinations.data ?? []).map((d) => [d.id, d]))

  if (routes.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {routes.data === undefined || routes.data.data.length === 0 ? (
        <EmptyState
          title="Nothing sends anywhere yet"
          description="Add a route to deliver submissions to a destination."
          action={
            <Button
              onClick={() => {
                setAddOpen(true)
              }}
            >
              Send to a destination
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {routes.data.data.map((route) => {
            const destination = destinationById.get(route.destination_id)
            return (
              <div key={route.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{destination?.name ?? route.destination_id}</span>
                    <Badge variant="muted" className="shrink-0">
                      {describeMode(route.mode as { readonly type: string; readonly cron?: string; readonly timezone?: string })}
                    </Badge>
                    {!route.enabled && (
                      <Badge variant="warning" className="shrink-0">
                        paused
                      </Badge>
                    )}
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {destination === undefined ? "destination" : `${destination.type} · ${describeDestination(destination)}`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={route.enabled}
                    onCheckedChange={(checked) => {
                      updateRoute.mutate(
                        { routeId: route.id, body: { enabled: checked } },
                        {
                          onError: (error) => {
                            toastApiError(error, "Couldn't update the route — try again.")
                          },
                        },
                      )
                    }}
                    aria-label={route.enabled ? "Disable route" : "Enable route"}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove route"
                    onClick={() => {
                      if (!window.confirm(`Stop sending to ${destination?.name ?? "this destination"}? The destination itself stays.`)) return
                      deleteRoute.mutate(route.id, {
                        onSuccess: () => {
                          toast.success("Route removed.")
                        },
                        onError: (error) => {
                          toastApiError(error, "Couldn't remove the route — try again.")
                        },
                      })
                    }}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            )
          })}
          <Button
            variant="outline"
            className="self-start"
            onClick={() => {
              setAddOpen(true)
            }}
          >
            Add route
          </Button>
        </div>
      )}
      <AddRouteDialog open={addOpen} onOpenChange={setAddOpen} subject={subject} />
    </div>
  )
}
