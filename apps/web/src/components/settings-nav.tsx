import { SubNav } from "@/components/sub-nav"

const TABS = [
  { to: "/settings", label: "General" },
  { to: "/settings/members", label: "Members" },
] as const

export function SettingsNav() {
  return <SubNav tabs={TABS} />
}
