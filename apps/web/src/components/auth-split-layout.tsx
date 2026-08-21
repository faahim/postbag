import type { ReactNode } from "react"

import { Postmark } from "@/components/postmark"

export function AuthSplitLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary px-12 py-10 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(120% 90% at 12% 8%, oklch(0.62 0.2 25) 0%, transparent 55%), radial-gradient(90% 70% at 90% 95%, oklch(0.46 0.16 20) 0%, transparent 60%)",
          }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.06]" style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, white 0 1px, transparent 1px 34px)",
        }} />

        <span className="relative z-10 flex items-center gap-2 text-sm font-semibold tracking-wide">
          <Postmark status="sent" size={22} className="text-primary-foreground" />
          Postbag
        </span>

        <div className="relative z-10 flex flex-col gap-8">
          <Postmark status="sent" size={168} className="text-primary-foreground/90" />
          <div className="flex max-w-md flex-col gap-3">
            <h1 className="text-3xl font-semibold text-balance">A form backend that routes.</h1>
            <p className="text-base text-primary-foreground/80 text-pretty">
              Point any HTML form at Postbag. Every submission is stored the instant it
              arrives, then delivered to email, Telegram or a webhook — never lost, never
              silently dropped.
            </p>
          </div>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/60">
          Self-hostable. Agent-native. One Postgres, one container.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
