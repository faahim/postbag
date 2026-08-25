import { createFileRoute } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState, type CSSProperties } from "react"
import { z } from "zod"

import { DestinationForm } from "@/components/destination-form"
import { DestinationRow } from "@/components/destination-row"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
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
    <div className="page-enter flex flex-col gap-8">
      <PageHeader
        title="Destinations"
        description="The places a Submission can be sent — an inbox, a chat, any URL."
        actions={
          <Button
            onClick={() => {
              setOpen(true)
            }}
          >
            <Plus />
            New Destination
          </Button>
        }
      />

      {destinations.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[4.5rem] w-full rounded-xl" />
          <Skeleton className="h-[4.5rem] w-full rounded-xl" />
        </div>
      ) : destinations.data === undefined || destinations.data.length === 0 ? (
        <EmptyState
          title="Nowhere to send things yet"
          description="A Destination is anywhere a Submission can land: your inbox, a Telegram chat, or any URL that can catch a webhook. Add one and Postbag starts the mail run."
          action={
            <Button
              size="lg"
              onClick={() => {
                setOpen(true)
              }}
            >
              Add a Destination
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {destinations.data.map((d, i) => (
            <div key={d.id} className="row-enter" style={{ "--row-index": i } as CSSProperties}>
              <DestinationRow destination={d} />
            </div>
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
              onSaved={() => {
                setOpen(false)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
