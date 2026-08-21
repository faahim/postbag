import { SubNav } from "@/components/sub-nav"

const TABS = [
  { to: "/events", label: "Log" },
  { to: "/events/webhooks", label: "Webhooks" },
] as const

export function EventsNav() {
  return <SubNav tabs={TABS} />
}
