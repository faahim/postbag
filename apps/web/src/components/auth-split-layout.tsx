import type { ReactNode } from "react"

const logoSrc = `${import.meta.env.BASE_URL}logo-mark-c27b566.svg`

export function AuthSplitLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <aside
        data-theme="dark"
        className="brand-ink-canvas relative hidden min-h-dvh overflow-hidden text-foreground lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-16"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-20 size-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -right-24 bottom-0 size-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-1/2 right-0 h-px w-2/5 bg-gradient-to-l from-primary/50 to-transparent" />
        </div>

        <div className="relative flex items-center gap-2.5 text-sm font-semibold tracking-tight">
          <img src={logoSrc} alt="" width={28} height={28} className="size-7 shrink-0" />
          Postbag
        </div>

        <div className="relative flex max-w-xl flex-col gap-8">
          <div className="relative w-fit">
            <div aria-hidden className="absolute inset-x-8 bottom-2 h-8 rounded-full bg-primary/20 blur-xl" />
            <img src={logoSrc} alt="" width={184} height={184} className="relative size-40 xl:size-44" />
          </div>
          <div className="flex flex-col gap-4">
            <h1 className="max-w-lg text-4xl leading-tight font-semibold tracking-tight text-balance xl:text-5xl">
              Your forms have somewhere to go.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-foreground/70 text-pretty">
              Postbag receives every Submission, keeps it safe, and routes it to the people and
              tools that need it.
            </p>
          </div>
        </div>

        <p className="relative text-xs text-foreground/55 text-pretty">
          Open source. Agent-native. Yours to run.
        </p>
      </aside>

      <main className="relative flex min-h-dvh items-center justify-center px-5 py-24 sm:px-8 lg:px-12 lg:py-16">
        <div className="absolute top-6 left-5 flex items-center gap-2 text-sm font-semibold tracking-tight sm:left-8 lg:hidden">
          <img src={logoSrc} alt="" width={26} height={26} className="size-6.5 shrink-0" />
          Postbag
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
