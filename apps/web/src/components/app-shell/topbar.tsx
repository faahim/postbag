import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ChevronsUpDown, LogOut, Monitor, Moon, Search, Sun } from "lucide-react"
import { useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api } from "@/lib/api"
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
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.GET("/v1/me")
      return data
    },
  })
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference())

  function applyTheme(next: ThemePreference) {
    setThemePreference(next)
    setTheme(next)
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 md:px-6">
      <button
        type="button"
        onClick={() => {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
        }}
        className="flex h-8 w-64 max-w-[40vw] items-center gap-2 rounded-md border border-input bg-card px-2.5 text-sm text-muted-foreground shadow-xs transition-colors duration-(--duration-quick) hover:bg-muted"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>

      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              {me.data?.organization.name ?? "Workspace"}
              <ChevronsUpDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{me.data?.organization.name ?? "Workspace"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                void navigate({ to: "/settings" })
              }}
            >
              Workspace settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Toggle theme">
              {theme === "dark" ? <Moon className="size-4" /> : theme === "light" ? <Sun className="size-4" /> : <Monitor className="size-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => { applyTheme("light") }}>
              <Sun /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { applyTheme("dark") }}>
              <Moon /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { applyTheme("system") }}>
              <Monitor /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
              <Avatar className="size-8">
                <AvatarFallback>{initials(session?.user.name ?? session?.user.email ?? "?")}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{session?.user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{session?.user.email}</span>
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
