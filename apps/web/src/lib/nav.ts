import { Activity, Inbox, KeyRound, ListChecks, Mailbox, Package, Settings, Truck } from "lucide-react"

export type NavItem = {
  readonly to: string
  readonly label: string
  readonly icon: typeof Inbox
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/forms", label: "Forms", icon: Mailbox },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/streams", label: "Streams", icon: Package },
  { to: "/destinations", label: "Destinations", icon: ListChecks },
  { to: "/deliveries", label: "Deliveries", icon: Truck },
  { to: "/events", label: "Events", icon: Activity },
  { to: "/api-keys", label: "API keys", icon: KeyRound },
  { to: "/settings", label: "Settings", icon: Settings },
]
