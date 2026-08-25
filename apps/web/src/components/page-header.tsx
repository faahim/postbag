import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** One header per screen: a generous title, one line of purpose, one action. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly actions?: ReactNode
  readonly className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{title}</h1>
        {description !== undefined && <p className="text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  )
}
