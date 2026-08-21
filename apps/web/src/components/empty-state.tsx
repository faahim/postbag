import type { ReactNode } from "react"

import { Postmark, type PostmarkStatus } from "@/components/postmark"
import { cn } from "@/lib/utils"

/** Every list gets one of these — illustration from the postmark motif family, one line
 * of copy, one primary action (docs/DESIGN.md §2). */
export function EmptyState({
  status = "pending",
  title,
  description,
  action,
  className,
}: {
  readonly status?: PostmarkStatus
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
      <div className="relative flex size-16 items-center justify-center rounded-full bg-muted/70">
        <Postmark status={status} size={40} />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description !== undefined && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  )
}
