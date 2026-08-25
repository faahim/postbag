import type { ReactNode } from "react"

import { BrandMark } from "@/components/brand-mark"
import { RoutingMark, type RoutingMarkStatus } from "@/components/routing-mark"
import { cn } from "@/lib/utils"

/**
 * Every list gets a designed empty state: a receiving mark, warm copy in the
 * product register, and one primary action. `brandMark` swaps the compact
 * routing mark for the large ambient Postbag mark — the same one that greets
 * people on the sign-in page — for hero moments like an empty Inbox.
 */
export function EmptyState({
  status = "pending",
  brandMark = false,
  title,
  description,
  action,
  className,
}: {
  readonly status?: RoutingMarkStatus
  readonly brandMark?: boolean
  readonly title: string
  readonly description?: ReactNode
  readonly action?: ReactNode
  readonly className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 px-8 text-center",
        brandMark ? "gap-2 py-16" : "gap-6 py-20",
        className,
      )}
    >
      <div className="page-enter contents">
        {brandMark ? (
          <div className="relative w-fit">
            <div aria-hidden className="absolute inset-x-10 bottom-4 h-10 rounded-full bg-primary/20 blur-2xl" />
            <BrandMark ambient className="relative size-40" />
          </div>
        ) : (
          <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-accent/55 shadow-inner">
            <span className="absolute inset-x-3.5 top-2.5 h-10 translate-x-1 rounded-lg bg-background/55" aria-hidden="true" />
            <RoutingMark status={status} size={52} className="relative" />
          </div>
        )}
        <div className="flex max-w-md flex-col gap-2">
          <p className="text-lg font-semibold tracking-tight text-balance text-foreground">{title}</p>
          {description !== undefined && <p className="text-[15px] leading-relaxed text-muted-foreground text-pretty">{description}</p>}
        </div>
        {action !== undefined && <div className="mt-2">{action}</div>}
      </div>
    </div>
  )
}
