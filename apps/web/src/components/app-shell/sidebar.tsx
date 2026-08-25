import { Link, useRouterState } from "@tanstack/react-router"
import type { CSSProperties } from "react"

import { BrandMark } from "@/components/brand-mark"
import { NAV_ITEMS } from "@/lib/nav"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const activeIndex = NAV_ITEMS.findIndex((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border/70 bg-card/60 px-4 py-5 md:flex">
      <Link
        to="/"
        className="mb-8 flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[15px] font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        data-brand-trigger
      >
        <BrandMark className="size-7 shrink-0" />
        Postbag
      </Link>

      <nav
        className="nav-rail flex flex-1 flex-col gap-1"
        data-no-active={activeIndex === -1}
        style={{ "--nav-active-index": activeIndex } as CSSProperties}
      >
        <span className="nav-rail-pill" aria-hidden="true" />
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex h-10 items-center gap-3 rounded-[calc(var(--radius)+2px)] px-3 text-sm font-medium",
                "transition-colors duration-(--duration-quick) ease-(--ease-smooth-out)",
                "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                active ? "text-accent-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-[18px] shrink-0 transition-transform duration-(--duration-fast) ease-(--ease-smooth-out)",
                  "group-hover:-translate-y-px group-hover:scale-105",
                )}
                strokeWidth={active ? 2.25 : 2}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
