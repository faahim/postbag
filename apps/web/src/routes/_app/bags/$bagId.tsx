import { createFileRoute, Navigate } from "@tanstack/react-router"

/** Compatibility redirect for dashboard links created before Stream became the fixed label. */
export const Route = createFileRoute("/_app/bags/$bagId")({
  component: LegacyStreamRedirect,
})

function LegacyStreamRedirect() {
  const { bagId } = Route.useParams()
  return <Navigate to="/streams/$streamId" params={{ streamId: bagId }} replace />
}
