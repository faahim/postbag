import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

/** Skeletons, not spinners (docs/DESIGN.md §3). Pulses via the transitions-dev
 * `--pulse-dur` token so loading rhythm stays consistent with the reveal transitions. */
function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      style={{ animationDuration: "var(--pulse-dur)" }}
      {...props}
    />
  )
}

export { Skeleton }
