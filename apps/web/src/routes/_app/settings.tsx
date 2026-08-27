import { createFileRoute, Outlet } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { SettingsNav } from "@/components/settings-nav"

export const Route = createFileRoute("/_app/settings")({
  component: SettingsLayout,
})

/** Shared chrome for the Settings tabs: the header and sub-nav stay put while
 * General/Members swap beneath them — no full-page re-entrance on tab change. */
function SettingsLayout() {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="page-enter flex flex-col gap-8">
        <PageHeader title="Settings" description="The workspace itself — its name, plan, timezone, and people." />
        <SettingsNav />
      </div>
      <div className="animate-in duration-(--duration-fast) ease-(--ease-smooth-out) fade-in-0 slide-in-from-bottom-1">
        <Outlet />
      </div>
    </div>
  )
}
