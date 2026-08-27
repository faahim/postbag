import { RoutingMark } from "@/components/routing-mark"

/** Branded success feedback: a received Form leaving along its Route. */
export function SuccessMark({ show, size = 18, className }: { readonly show: boolean; readonly size?: number; readonly className?: string }) {
  if (!show) return null
  return (
    <span className={className} aria-hidden="true">
      <RoutingMark status="sent" size={size} tone="accent" className="animate-in zoom-in-75 fade-in" />
    </span>
  )
}
