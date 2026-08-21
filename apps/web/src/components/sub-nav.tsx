import { Link, useRouterState } from "@tanstack/react-router"

import { cn } from "@/lib/utils"

export type SubNavTab = { readonly to: string; readonly label: string }

/** Second-level tabs under a page title (Settings · General | Members, Events · Log | Webhooks).
 * Route-driven so each tab is a real URL. */
export function SubNav({ tabs }: { readonly tabs: readonly SubNavTab[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className="flex gap-1 border-b border-border/70">
      {tabs.map((tab) => {
        const active = pathname === tab.to || pathname === `${tab.to}/`
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
