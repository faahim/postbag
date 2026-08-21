import { useState } from "react"
import { toast } from "sonner"

import { DestinationForm } from "@/components/destination-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDestinations } from "@/lib/queries/destinations"
import { useCreateRoute } from "@/lib/queries/routes"

export type RouteSubject = { readonly formId: string } | { readonly streamId: string }

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
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [creatingNew, setCreatingNew] = useState(false)

  async function addRoute(destinationId: string) {
    await createRoute.mutateAsync({
      destination_id: destinationId,
      ...("formId" in subject ? { form_id: subject.formId } : { stream_id: subject.streamId }),
    })
    toast.success("Route added.")
    setSelected(undefined)
    setCreatingNew(false)
    onOpenChange(false)
  }

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
          <DialogTitle>Send to a destination</DialogTitle>
          <DialogDescription>
            {"formId" in subject
              ? "Deliver every submission on this form directly."
              : "Deliver everything this bag collects."}
          </DialogDescription>
        </DialogHeader>

        {creatingNew ? (
          <DestinationForm
            submitLabel="Create and send to"
            onCreated={(destination) => {
              void addRoute(destination.id)
            }}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {destinations.data !== undefined && destinations.data.length > 0 ? (
              <>
                <Select value={selected ?? ""} onValueChange={setSelected}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a destination" />
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
