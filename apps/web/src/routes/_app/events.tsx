import { createFileRoute, Outlet } from "@tanstack/react-router"

import { EventsNav } from "@/components/events-nav"
import { PageHeader } from "@/components/page-header"

export const Route = createFileRoute("/_app/events")({
  component: EventsLayout,
})

/** Shared chrome for the Events tabs: header and sub-nav stay put while
 * Log/Webhooks swap beneath them — no full-page re-entrance on tab change. */
function EventsLayout() {
  return (
    <div className="flex flex-col gap-8">
      <div className="page-enter flex flex-col gap-8">
        <PageHeader title="Events" description="Everything that happened in this workspace, most recent first." />
        <EventsNav />
      </div>
      <div className="animate-in duration-(--duration-fast) ease-(--ease-smooth-out) fade-in-0 slide-in-from-bottom-1">
        <Outlet />
      </div>
    </div>
  )
}
