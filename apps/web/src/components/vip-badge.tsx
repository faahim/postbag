import { Stamp } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * Job K addendum — a small, playful marker for orgs whose plan_source is
 * "complimentary" (read from /v1/me; never a hardcoded email list). Shown beside the
 * org/user name in the topbar and on Settings → Plan. It uses existing accent tokens,
 * a postage-stamp motif, and one small
 * bounce-in entrance on first render using the transitions-dev "badge appear" tokens
 * (--duration-very-slow / --ease-bounce) — reduced motion is handled globally in
 * styles/tokens.css, so no extra guard is needed here.
 */
export function VipBadge({ className }: { readonly className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex shrink-0 animate-in items-center gap-1 rounded-full border border-primary/20",
            "bg-primary/10 px-2 py-0.5 text-[11px] leading-none font-medium text-primary",
            "fade-in-0 zoom-in-75 duration-(--duration-very-slow) ease-(--ease-bounce) outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Stamp className="size-3" />
          VIP · postage prepaid
        </span>
      </TooltipTrigger>
      <TooltipContent>Complimentary plan, courtesy of Postbag.</TooltipContent>
    </Tooltip>
  )
}
