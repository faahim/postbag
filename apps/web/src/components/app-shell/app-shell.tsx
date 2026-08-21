import type { ReactNode } from "react"

import { CommandPalette } from "@/components/app-shell/command-palette"
import { Sidebar } from "@/components/app-shell/sidebar"
import { Topbar } from "@/components/app-shell/topbar"

export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
