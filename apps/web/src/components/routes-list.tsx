import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { AddRouteDialog, type RouteSubject } from "@/components/add-route-dialog"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useDestinations } from "@/lib/queries/destinations"
import { useDeleteRoute, useRoutes, useUpdateRoute } from "@/lib/queries/routes"

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
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{destination?.name ?? route.destination_id}</span>
                  <span className="text-xs text-muted-foreground">{destination?.type ?? "destination"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={route.enabled}
                    onCheckedChange={(checked) => {
                      updateRoute.mutate(
                        { routeId: route.id, body: { enabled: checked } },
                        {
                          onError: () => {
                            toast.error("Couldn't update the route.")
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
                      deleteRoute.mutate(route.id, {
                        onSuccess: () => {
                          toast.success("Route removed.")
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
