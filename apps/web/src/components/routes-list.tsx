import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  AddRouteDialog,
  CadencePicker,
  type RouteSubject,
} from "@/components/add-route-dialog"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { describeDestination } from "@/components/destination-row"
import { Badge } from "@/components/ui/badge"
import { toastApiError } from "@/lib/api"
import { cadenceStateFromMode, isCadenceComplete, modeFor, type CadenceState } from "@/lib/cadence"
import { useDestinations, type Destination } from "@/lib/queries/destinations"
import { useMe } from "@/lib/queries/me"
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

type Route = {
  readonly id: string
  readonly destination_id: string
  readonly enabled: boolean
  readonly mode: Readonly<Record<string, unknown>>
}

export function RoutesList({ subject }: { readonly subject: RouteSubject }) {
  const routes = useRoutes("formId" in subject ? { form: subject.formId } : { stream: subject.streamId })
  const destinations = useDestinations()
  const [addOpen, setAddOpen] = useState(false)

  const destinationById = new Map((destinations.data ?? []).map((d) => [d.id, d]))

  if (routes.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[4.5rem] w-full rounded-xl" />
        <Skeleton className="h-[4.5rem] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {routes.data === undefined || routes.data.data.length === 0 ? (
        <EmptyState
          title="Nothing sends anywhere yet"
          description="Add a Route to deliver Submissions to a Destination."
          action={
            <Button
              onClick={() => {
                setAddOpen(true)
              }}
            >
              Send to a Destination
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {routes.data.data.map((route) => (
            <RouteRow key={route.id} route={route as Route} destination={destinationById.get(route.destination_id)} />
          ))}
          <Button
            variant="outline"
            className="self-start"
            onClick={() => {
              setAddOpen(true)
            }}
          >
            Add Route
          </Button>
        </div>
      )}
      <AddRouteDialog open={addOpen} onOpenChange={setAddOpen} subject={subject} />
    </div>
  )
}

function RouteRow({ route, destination }: { readonly route: Route; readonly destination: Destination | undefined }) {
  const updateRoute = useUpdateRoute()
  const deleteRoute = useDeleteRoute()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [editing, setEditing] = useState(false)
  const mode = route.mode as { readonly type: string; readonly cron?: string; readonly timezone?: string }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-5 py-4 shadow-xs">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium">{destination?.name ?? route.destination_id}</span>
          <Badge variant="muted" className="shrink-0">
            {describeMode(mode)}
          </Badge>
          {!route.enabled && (
            <Badge variant="warning" className="shrink-0">
              paused
            </Badge>
          )}
        </div>
        <span className="truncate text-sm text-muted-foreground">
          {destination === undefined ? "Destination" : `${destination.type} · ${describeDestination(destination)}`}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit delivery"
          className="text-muted-foreground"
          onClick={() => {
            setEditing(true)
          }}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove route"
          className="text-muted-foreground"
          onClick={() => {
            setConfirmRemove(true)
          }}
        >
          <Trash2 className="size-4" />
        </Button>
        <Switch
          checked={route.enabled}
          onCheckedChange={(checked) => {
            updateRoute.mutate(
              { routeId: route.id, body: { enabled: checked } },
              {
                onError: (error) => {
                  toastApiError(error, "Couldn't update the Route — try again.")
                },
              },
            )
          }}
          aria-label={route.enabled ? "Pause this Route" : "Resume this Route"}
        />
      </div>

      <EditRouteDialog route={route} destinationName={destination?.name} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Stop sending to ${destination?.name ?? "this Destination"}?`}
        description="Only this Route goes — the Destination itself stays, and every Submission already saved is untouched."
        confirmLabel="Remove Route"
        pending={deleteRoute.isPending}
        onConfirm={() => {
          deleteRoute.mutate(route.id, {
            onSuccess: () => {
              setConfirmRemove(false)
              toast.success("Route removed.")
            },
            onError: (error) => {
              toastApiError(error, "Couldn't remove the Route — try again.")
            },
          })
        }}
      />
    </div>
  )
}

/** Change how (not where) an existing Route delivers — instant vs. a digest. */
function EditRouteDialog({
  route,
  destinationName,
  open,
  onOpenChange,
}: {
  readonly route: Route
  readonly destinationName: string | undefined
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  const me = useMe()
  const updateRoute = useUpdateRoute()
  const mode = route.mode as { readonly type: string; readonly cron?: string; readonly timezone?: string }
  const [cadence, setCadence] = useState<CadenceState>(() => cadenceStateFromMode(mode))
  const timezone = mode.timezone ?? me.data?.organization.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const cadenceComplete = isCadenceComplete(cadence)

  function save() {
    if (!cadenceComplete) return
    updateRoute.mutate(
      { routeId: route.id, body: { mode: modeFor(cadence, timezone) } },
      {
        onSuccess: () => {
          onOpenChange(false)
          toast.success("Delivery updated.")
        },
        onError: (error) => {
          toastApiError(error, "Couldn't update the Route — try again.")
        },
      },
    )
  }

  function changeOpen(next: boolean) {
    if (!next) setCadence(cadenceStateFromMode(mode))
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit delivery</DialogTitle>
          <DialogDescription>
            {destinationName === undefined ? "How this Route delivers." : `How this Route delivers to ${destinationName}. To send somewhere else, add a new Route.`}
          </DialogDescription>
        </DialogHeader>
        <CadencePicker value={cadence} onChange={setCadence} timezone={timezone} />
        <DialogFooter>
          <Button onClick={save} disabled={!cadenceComplete || updateRoute.isPending}>
            {updateRoute.isPending ? "Saving…" : "Save delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
