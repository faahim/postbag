import { Check, Copy } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Copy-to-clipboard with the "copied" micro-state — icon cross-fades via the
 * transitions-dev icon-swap pattern (docs/DESIGN.md §3). */
export function CopyButton({ value, label = "Copy", className }: { readonly value: string; readonly label?: string; readonly className?: string }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setCopied(false)
    }, 1600)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5", className)}
      onClick={() => {
        void handleCopy()
      }}
    >
      <span className="t-icon-swap size-3.5" data-state={copied ? "b" : "a"}>
        <Copy className="t-icon size-3.5" data-icon="a" />
        <Check className="t-icon size-3.5 text-success" data-icon="b" />
      </span>
      {copied ? "Copied" : label}
    </Button>
  )
}
