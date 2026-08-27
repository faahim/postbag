import { useNavigate } from "@tanstack/react-router"
import { LogOut, Monitor, Moon, Search, Sun } from "lucide-react"
import { useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { OrgSwitcher } from "@/components/app-shell/org-switcher"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut, useSession } from "@/lib/auth-client"
import { getThemePreference, setThemePreference, type ThemePreference } from "@/lib/theme"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/u)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase() || "?"
}

export function Topbar() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference())

  function applyTheme(next: ThemePreference) {
    setThemePreference(next)
    setTheme(next)
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/70 px-5 sm:gap-3 md:px-8">
      <button
        type="button"
        aria-label="Search"
        onClick={() => {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
        }}
        className="btn-raised flex size-10 shrink-0 items-center justify-center rounded-lg text-sm text-muted-foreground transition-[background-color,box-shadow,color] duration-(--duration-quick) ease-(--ease-smooth-out) hover:text-foreground sm:h-9 sm:w-72 sm:max-w-[40vw] sm:justify-start sm:gap-2.5 sm:px-3"
      >
        <Search className="size-4" />
        <span className="hidden flex-1 text-left sm:inline">Search…</span>
        <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="flex min-w-0 items-center gap-1.5">
        <OrgSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Toggle theme">
              {theme === "dark" ? (
                <Moon className="size-4" />
              ) : theme === "light" ? (
                <Sun className="size-4" />
              ) : (
                <Monitor className="size-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                applyTheme("light")
              }}
            >
              <Sun /> Light
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                applyTheme("dark")
              }}
            >
              <Moon /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                applyTheme("system")
              }}
            >
              <Monitor /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              <Avatar className="size-8">
                <AvatarFallback>
                  {initials(session?.user.name ?? session?.user.email ?? "?")}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{session?.user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {session?.user.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                void signOut().then(() => navigate({ to: "/sign-in" }))
              }}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
