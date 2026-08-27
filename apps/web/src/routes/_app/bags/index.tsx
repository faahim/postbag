import { createFileRoute, Navigate } from "@tanstack/react-router"

/** Compatibility redirect for dashboard links created before Stream became the fixed label. */
export const Route = createFileRoute("/_app/bags/")({
  component: LegacyStreamsRedirect,
})

function LegacyStreamsRedirect() {
  return <Navigate to="/streams" replace />
}
