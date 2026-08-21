import { Link, useRouterState } from "@tanstack/react-router"

import { cn } from "@/lib/utils"

const TABS = [
  { to: "/settings", label: "General" },
  { to: "/settings/members", label: "Members" },
] as const

export function SettingsNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className="flex gap-1 border-b border-border/70">
      {TABS.map((tab) => {
        const active = pathname === tab.to
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "relative px-3 pb-2.5 text-sm font-medium transition-colors duration-(--duration-quick)",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground transition-transform duration-(--duration-quick)",
                active ? "scale-x-100" : "scale-x-0",
              )}
            />
          </Link>
        )
      })}
    </nav>
  )
}
