import type { ReactNode } from "react"

import { BrandMark } from "@/components/brand-mark"
import { cn } from "@/lib/utils"

/**
 * The standard empty-state illustration: a Form card settling into a receiving
 * pocket (the brand's lip dip included), drawn as quiet line art in
 * currentColor so it reads correctly on both themes.
 */
function EmptyStateMark({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 120 88" fill="none" aria-hidden="true" className={cn("text-primary", className)}>
      {/* the descending Form card */}
      <g transform="rotate(-6 60 22)">
        <rect x="44" y="10" width="32" height="24" rx="5" className="fill-card" stroke="currentColor" strokeOpacity="0.7" strokeWidth="2" />
        <path d="M50 18h20M50 24h13" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* its descent */}
      <path d="M60 38v10" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" strokeDasharray="1.5 5" />
      {/* the pocket, lip dip and all */}
      <path
        d="M24 50c0-2.2 1.8-4 4-4h16c6 0 10 6 16 6s10-6 16-6h16c2.2 0 4 1.8 4 4v16c0 5.5-4.5 10-10 10H34c-5.5 0-10-4.5-10-10V50Z"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M24 50c0-2.2 1.8-4 4-4h16c6 0 10 6 16 6s10-6 16-6h16c2.2 0 4 1.8 4 4v16c0 5.5-4.5 10-10 10H34c-5.5 0-10-4.5-10-10V50Z"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Every list gets a designed empty state: the receiving mark, warm copy in the
 * product register, and one primary action. `brandMark` swaps the drawn mark
 * for the large ambient Postbag mark — the same one that greets people on the
 * sign-in page — for hero moments like an empty Inbox.
 */
export function EmptyState({
  brandMark = false,
  title,
  description,
  action,
  className,
}: {
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
          <div className="flex size-24 items-center justify-center rounded-2xl bg-accent/50 shadow-inner">
            <EmptyStateMark className="w-16" />
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
