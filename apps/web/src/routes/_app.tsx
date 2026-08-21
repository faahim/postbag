import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { AppShell } from "@/components/app-shell/app-shell"
import { Postmark } from "@/components/postmark"
import { useSession } from "@/lib/auth-client"

export const Route = createFileRoute("/_app")({
  component: AppLayout,
})

function AppLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isPending && session == null) {
      void navigate({ to: "/sign-in" })
    }
  }, [isPending, session, navigate])

  if (isPending || session == null) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Postmark status="pending" size={32} className="animate-pulse" />
      </div>
    )
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
