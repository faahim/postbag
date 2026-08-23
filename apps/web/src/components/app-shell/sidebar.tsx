import { Link, useRouterState } from "@tanstack/react-router"

import { NAV_ITEMS } from "@/lib/nav"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border/70 bg-card/60 px-3 py-4 md:flex">
      <Link to="/" className="mb-6 flex items-center gap-2 px-2 text-sm font-semibold tracking-tight">
        <img src={`${import.meta.env.BASE_URL}logo-mark-455264e.svg`} alt="" width={24} height={24} className="size-6 shrink-0" />
        Postbag
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium",
                "transition-colors duration-(--duration-quick)",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={2} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
