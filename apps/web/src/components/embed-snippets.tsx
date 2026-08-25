import { useState } from "react"

import { CopyButton } from "@/components/copy-button"
import { cn } from "@/lib/utils"

export type EmbedSnippets = {
  readonly html: string
  readonly fetch: string
  readonly react: string
  readonly astro: string
  readonly nextjs_action: string
}

const TABS: readonly { readonly key: keyof EmbedSnippets; readonly label: string }[] = [
  { key: "html", label: "HTML" },
  { key: "fetch", label: "fetch" },
  { key: "react", label: "React" },
  { key: "astro", label: "Astro" },
  { key: "nextjs_action", label: "Next.js" },
]

/**
 * One code card, not a second pill bar: the technology switcher lives quietly in
 * the card's own header so it never competes with the screen's real tabs.
 */
export function EmbedSnippetTabs({ embed }: { readonly embed: EmbedSnippets }) {
  const [active, setActive] = useState<keyof EmbedSnippets>("html")

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 py-2 pr-2.5 pl-2">
        <div className="flex items-center gap-0.5" role="tablist" aria-label="Snippet language">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active === tab.key}
              onClick={() => {
                setActive(tab.key)
              }}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[13px] font-medium",
                "transition-[background-color,color] duration-(--duration-quick) ease-(--ease-smooth-out)",
                "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                active === tab.key ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <CopyButton value={embed[active]} variant="ghost" className="h-8 text-muted-foreground hover:text-foreground" />
      </div>
      <pre
        key={active}
        className="max-h-80 overflow-auto p-4 font-mono text-[13px] leading-relaxed text-foreground animate-in duration-(--duration-quick) fade-in-0"
      >
        <code>{embed[active]}</code>
      </pre>
    </div>
  )
}
