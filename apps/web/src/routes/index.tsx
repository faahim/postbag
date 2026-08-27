import { createFileRoute, Navigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import { api } from "@/lib/api"
import { useSession } from "@/lib/auth-client"

export const Route = createFileRoute("/")({
  component: IndexRoute,
})

function IndexRoute() {
  const { data: session, isPending } = useSession()

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.GET("/v1/me")
      return data
    },
    enabled: session !== null,
  })

  if (isPending || (session != null && me.isLoading)) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        role="status"
        aria-label="Loading Postbag"
      >
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      </div>
    )
  }

  if (session == null) return <Navigate to="/sign-in" />
  if (me.data?.counts.forms === 0) return <Navigate to="/first-run" />
  return <Navigate to="/forms" />
}
