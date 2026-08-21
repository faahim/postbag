import { createFileRoute } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { DestinationForm } from "@/components/destination-form"
import { DestinationRow } from "@/components/destination-row"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useDestinations } from "@/lib/queries/destinations"

const searchSchema = z.object({ new: z.boolean().optional() })

export const Route = createFileRoute("/_app/destinations/")({
  component: DestinationsRoute,
  validateSearch: searchSchema,
})

function DestinationsRoute() {
  const search = Route.useSearch()
  const destinations = useDestinations()
  const [open, setOpen] = useState(search.new === true)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Destinations</h1>
          <p className="text-sm text-muted-foreground">Somewhere submissions can be sent.</p>
        </div>
        <Button
          onClick={() => {
            setOpen(true)
          }}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          New destination
        </Button>
      </div>

      {destinations.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : destinations.data === undefined || destinations.data.length === 0 ? (
        <EmptyState
          title="No destinations yet"
          description="Email, Telegram or a webhook — pick where submissions should land."
          action={
            <Button
              onClick={() => {
                setOpen(true)
              }}
            >
              Create a destination
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {destinations.data.map((d) => (
            <DestinationRow key={d.id} destination={d} />
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>New destination</SheetTitle>
            <SheetDescription>Pick a type and fill in where submissions should go.</SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-6">
            <DestinationForm
              onCreated={() => {
                setOpen(false)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
