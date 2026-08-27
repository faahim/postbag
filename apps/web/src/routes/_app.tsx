import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router"
import { useEffect, useRef } from "react"

import { AppShell } from "@/components/app-shell/app-shell"
import { RoutingMark } from "@/components/routing-mark"
import { useSession } from "@/lib/auth-client"

export const Route = createFileRoute("/_app")({
  component: AppLayout,
})

function AppLayout() {
  const { data: session, isPending } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const protectedDestination = useRef(location.href)
  const redirectStarted = useRef(false)

  useEffect(() => {
    if (!isPending && session == null && !redirectStarted.current) {
      redirectStarted.current = true
      void navigate({
        to: "/sign-in",
        search: { redirect: protectedDestination.current },
        replace: true,
      })
    }
  }, [isPending, session, navigate])

  if (isPending || session == null) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <RoutingMark status="pending" size={32} className="animate-pulse" />
      </div>
    )
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
