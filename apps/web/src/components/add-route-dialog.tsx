import { useState } from "react"
import { toast } from "sonner"

import { DestinationForm } from "@/components/destination-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toastApiError } from "@/lib/api"
import { useDestinations } from "@/lib/queries/destinations"
import { useMe } from "@/lib/queries/me"
import { useCreateRoute } from "@/lib/queries/routes"

export type RouteSubject = { readonly formId: string } | { readonly streamId: string }

type Cadence = "instant" | "daily" | "weekly"
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const

/** The dashboard offers the digest subset the worker supports (core `digestPeriodKey`): a fixed
 * minute and hour, every day or on one weekday. Anything fancier is an API/CLI job. */
function modeFor(cadence: Cadence, time: string, weekday: number, timezone: string) {
  if (cadence === "instant") return { type: "instant" as const }
  const [h, m] = time.split(":")
  const hour = Number(h)
  const minute = Number(m)
  const cron = `${Number.isInteger(minute) ? minute : 0} ${Number.isInteger(hour) ? hour : 8} * * ${cadence === "weekly" ? weekday : "*"}`
  return { type: "digest" as const, cron, timezone }
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
  const [cadence, setCadence] = useState<Cadence>("instant")
  const [time, setTime] = useState("08:00")
  const [weekday, setWeekday] = useState(1)
  const timezone = me.data?.organization.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  async function addRoute(destinationId: string) {
    try {
      await createRoute.mutateAsync({
        destination_id: destinationId,
        ...("formId" in subject ? { form_id: subject.formId } : { stream_id: subject.streamId }),
        mode: modeFor(cadence, time, weekday, timezone),
      })
      toast.success(cadence === "instant" ? "Route added." : "Digest route added.", {
        description: cadence === "instant" ? undefined : `One message per ${cadence === "daily" ? "day" : "week"} at ${time} (${timezone}); quiet periods send nothing.`,
      })
      setSelected(undefined)
      setCreatingNew(false)
      onOpenChange(false)
    } catch (error) {
      toastApiError(error, "Couldn't add the route — try again.")
    }
  }

  const cadencePicker = (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">
      <Label className="text-xs text-muted-foreground">Deliver</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={cadence}
          onValueChange={(v) => {
            setCadence(v as Cadence)
          }}
        >
          <SelectTrigger className="h-8 w-44" aria-label="Delivery cadence">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instant">Each submission, instantly</SelectItem>
            <SelectItem value="daily">Daily digest</SelectItem>
            <SelectItem value="weekly">Weekly digest</SelectItem>
          </SelectContent>
        </Select>
        {cadence === "weekly" && (
          <Select
            value={String(weekday)}
            onValueChange={(v) => {
              setWeekday(Number(v))
            }}
          >
            <SelectTrigger className="h-8 w-36" aria-label="Weekday">
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
        {cadence !== "instant" && (
          <>
            <span className="text-xs text-muted-foreground">at</span>
            <Input
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value)
              }}
              className="h-8 w-28"
              aria-label="Digest time"
            />
            <span className="text-xs text-muted-foreground">{timezone}</span>
          </>
        )}
      </div>
      {cadence !== "instant" && (
        <p className="text-xs text-muted-foreground">One message covering the whole period — nothing is sent for an empty period.</p>
      )}
    </div>
  )

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
                  disabled={selected === undefined || createRoute.isPending}
                  onClick={() => {
                    if (selected !== undefined) void addRoute(selected)
                  }}
                >
                  {createRoute.isPending ? "Adding…" : "Add route"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No destinations yet — create one below.</p>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setCreatingNew(true)
              }}
            >
              Create a new destination
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
