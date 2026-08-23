import type { ReactNode } from "react"

import { RoutingMark, type RoutingMarkStatus } from "@/components/routing-mark"
import { cn } from "@/lib/utils"

/** Every list gets a quiet receiving mark, one line of copy, and one primary action. */
export function EmptyState({
  status = "pending",
  title,
  description,
  action,
  className,
}: {
  readonly status?: RoutingMarkStatus
  readonly title: string
  readonly description?: string
  readonly action?: ReactNode
  readonly className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border px-6 py-16 text-center",
        className,
      )}
    >
      <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-xl bg-accent/55 shadow-inner">
        <span className="absolute inset-x-3 top-2 h-8 translate-x-1 rounded-md bg-background/55" aria-hidden="true" />
        <RoutingMark status={status} size={42} className="relative" />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description !== undefined && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  )
}
