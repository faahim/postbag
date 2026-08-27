import { useState } from "react"
import { toast } from "sonner"

import { DestinationForm } from "@/components/destination-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toastApiError } from "@/lib/api"
import {
  DEFAULT_CADENCE,
  isCadenceComplete,
  modeFor,
  type Cadence,
  type CadenceState,
} from "@/lib/cadence"
import { useDestinations } from "@/lib/queries/destinations"
import { useMe } from "@/lib/queries/me"
import { useCreateRoute } from "@/lib/queries/routes"

export type RouteSubject = { readonly formId: string } | { readonly streamId: string }

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const

/** Cadence controls shared by "add a Route" and "edit this Route's delivery". */
export function CadencePicker({
  value,
  onChange,
  timezone,
}: {
  readonly value: CadenceState
  readonly onChange: (next: CadenceState) => void
  readonly timezone: string
}) {
  const complete = isCadenceComplete(value)

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-4">
      <Label className="text-xs text-muted-foreground">Deliver</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={value.cadence}
          onValueChange={(v) => {
            onChange({ ...value, cadence: v as Cadence })
          }}
        >
          <SelectTrigger className="h-9 w-56" aria-label="Delivery cadence">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instant">Each Submission, instantly</SelectItem>
            <SelectItem value="daily">Daily digest</SelectItem>
            <SelectItem value="weekly">Weekly digest</SelectItem>
          </SelectContent>
        </Select>
        {value.cadence === "weekly" && (
          <Select
            value={String(value.weekday)}
            onValueChange={(v) => {
              onChange({ ...value, weekday: Number(v) })
            }}
          >
            <SelectTrigger className="h-9 w-36" aria-label="Weekday">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((day, i) => (
                <SelectItem key={day} value={String(i)}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {value.cadence !== "instant" && (
          <>
            <span className="text-xs text-muted-foreground">at</span>
            <Input
              type="time"
              value={value.time}
              onChange={(e) => {
                onChange({ ...value, time: e.target.value })
              }}
              className="h-9 w-28"
              aria-label="Digest time"
              aria-invalid={!complete}
              required
            />
            <span className="text-xs text-muted-foreground">{timezone}</span>
          </>
        )}
      </div>
      {value.cadence !== "instant" && (
        complete ? (
          <p className="text-xs text-muted-foreground">One message covering the whole period — nothing is sent for an empty period.</p>
        ) : (
          <p role="alert" className="text-xs text-destructive">Choose a complete delivery time.</p>
        )
      )}
    </div>
  )
}

export function AddRouteDialog({
  open,
  onOpenChange,
  subject,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly subject: RouteSubject
}) {
  const destinations = useDestinations()
  const createRoute = useCreateRoute()
  const me = useMe()
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [creatingNew, setCreatingNew] = useState(false)
  const [cadence, setCadence] = useState<CadenceState>(DEFAULT_CADENCE)
  const timezone = me.data?.organization.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const cadenceComplete = isCadenceComplete(cadence)

  async function addRoute(destinationId: string) {
    if (!cadenceComplete) {
      toast.error("Choose a complete delivery time.")
      return
    }
    try {
      await createRoute.mutateAsync({
        destination_id: destinationId,
        ...("formId" in subject ? { form_id: subject.formId } : { stream_id: subject.streamId }),
        mode: modeFor(cadence, timezone),
      })
      toast.success(cadence.cadence === "instant" ? "Route added." : "Digest route added.", {
        description:
          cadence.cadence === "instant"
            ? undefined
            : `One message per ${cadence.cadence === "daily" ? "day" : "week"} at ${cadence.time} (${timezone}); quiet periods send nothing.`,
      })
      setSelected(undefined)
      setCreatingNew(false)
      onOpenChange(false)
    } catch (error) {
      toastApiError(error, "Couldn't add the route — try again.")
    }
  }

  const cadencePicker = <CadencePicker value={cadence} onChange={setCadence} timezone={timezone} />

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setCreatingNew(false)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to a Destination</DialogTitle>
          <DialogDescription>
            {"formId" in subject
              ? "Deliver every Submission on this Form directly."
              : "Deliver everything this Stream collects."}
          </DialogDescription>
        </DialogHeader>

        {cadencePicker}

        {creatingNew ? (
          <DestinationForm
            submitLabel="Create and send to"
            onSaved={(destination) => {
              void addRoute(destination.id)
            }}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {destinations.data !== undefined && destinations.data.length > 0 ? (
              <>
                <Select value={selected ?? ""} onValueChange={setSelected}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinations.data.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} · {d.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={selected === undefined || !cadenceComplete || createRoute.isPending}
                  onClick={() => {
                    if (selected !== undefined) void addRoute(selected)
                  }}
                >
                  {createRoute.isPending ? "Adding…" : "Add route"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No Destinations yet — create one below.</p>
            )}
            <Button
              variant="outline"
              disabled={!cadenceComplete}
              onClick={() => {
                setCreatingNew(true)
              }}
            >
              Create a new Destination
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
