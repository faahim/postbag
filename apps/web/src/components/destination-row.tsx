import { useState } from "react"
import { Trash2 } from "lucide-react"

import { SuccessCheck } from "@/components/success-check"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useDeleteDestination, useTestDestination } from "@/lib/queries/destinations"

const HEALTH_DOT = {
  ok: "bg-success",
  failing: "bg-destructive",
  unknown: "bg-muted-foreground/40",
} as const

export function DestinationRow({
  destination,
}: {
  readonly destination: {
    readonly id: string
    readonly name: string
    readonly type: string
    readonly health: "ok" | "failing" | "unknown"
    readonly verified: boolean
  }
}) {
  const test = useTestDestination()
  const deleteDestination = useDeleteDestination()
  const [result, setResult] = useState<{ readonly ok: boolean; readonly detail: string } | null>(null)

  async function runTest() {
    setResult(null)
    try {
      const response = await test.mutateAsync(destination.id)
      setResult({
        ok: response.ok ?? false,
        detail: response.error ?? `${response.status_code?.toString() ?? "—"} · ${(response.latency_ms ?? 0).toFixed(0)}ms`,
      })
    } catch {
      setResult({ ok: false, detail: "Request failed." })
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn("size-2 shrink-0 rounded-full", HEALTH_DOT[destination.health])}
            title={`Health: ${destination.health}`}
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{destination.name}</span>
            <span className="text-xs text-muted-foreground capitalize">{destination.type}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => void runTest()} disabled={test.isPending} className="gap-1.5">
            {result?.ok === true && <SuccessCheck show size={14} />}
            {test.isPending ? "Testing…" : "Test"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete destination"
            onClick={() => {
              deleteDestination.mutate(destination.id)
            }}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
      {result !== null && (
        <p className={cn("rounded-md px-2.5 py-1.5 font-mono text-xs", result.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
          {result.detail}
        </p>
      )}
    </div>
  )
}
