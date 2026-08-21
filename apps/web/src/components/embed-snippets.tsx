import { CopyButton } from "@/components/copy-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

export function EmbedSnippetTabs({ embed }: { readonly embed: EmbedSnippets }) {
  return (
    <Tabs defaultValue="html">
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((tab) => (
        <TabsContent key={tab.key} value={tab.key} className="relative">
          <pre className="max-h-80 overflow-auto rounded-lg border border-border/70 bg-muted/50 p-4 pr-20 font-mono text-[13px] leading-relaxed text-foreground">
            <code>{embed[tab.key]}</code>
          </pre>
          <CopyButton value={embed[tab.key]} className="absolute top-2.5 right-2.5" />
        </TabsContent>
      ))}
    </Tabs>
  )
}
