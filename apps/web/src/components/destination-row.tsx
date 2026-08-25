import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { DESTINATION_TYPES, DestinationForm } from "@/components/destination-form"
import { SuccessMark } from "@/components/success-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toastApiError } from "@/lib/api"
import { useDeleteDestination, useTestDestination, type Destination } from "@/lib/queries/destinations"
import { cn } from "@/lib/utils"

const HEALTH = {
  ok: { dot: "bg-success", label: "Healthy — the last delivery went through." },
  failing: { dot: "bg-destructive", label: "Failing — recent deliveries did not go through. Test it, or check the destination's settings." },
  unknown: { dot: "bg-muted-foreground/40", label: "No deliveries yet — press Test to check it works." },
} as const

/** Where this destination actually sends — the line that was missing. Built from the
 * (secret-redacted) config the API already returns. */
export function describeDestination(destination: Destination): string {
  const config = destination.config as Record<string, unknown>
  const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [])
  const str = (value: unknown): string | undefined => (typeof value === "string" && value.length > 0 ? value : undefined)
  switch (destination.type) {
    case "email": {
      const to = list(config["to"])
      const cc = list(config["cc"])
      const head = to.length === 0 ? "No recipient set" : to.join(", ")
      return cc.length === 0 ? head : `${head} · cc ${cc.join(", ")}`
    }
    case "telegram": {
      const chat = str(config["chat_id"])
      return chat === undefined ? "No chat set" : `Chat ${chat}`
    }
    case "webhook":
    case "slack":
    case "discord": {
      const url = str(config["url"])
      if (url === undefined) return "No URL set"
      try {
        const parsed = new URL(url)
        return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`
      } catch {
        return url
      }
    }
    default:
      return destination.type
  }
}

export function DestinationRow({ destination }: { readonly destination: Destination }) {
  const test = useTestDestination()
  const deleteDestination = useDeleteDestination()
  const [result, setResult] = useState<{ readonly ok: boolean; readonly detail: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const typeMeta = DESTINATION_TYPES.find((t) => t.value === destination.type)
  const health = HEALTH[destination.health]
  const summary = describeDestination(destination)

  async function runTest() {
    setResult(null)
    try {
      const response = await test.mutateAsync(destination.id)
      setResult({
        ok: response.ok ?? false,
        detail: response.ok === true
          ? `Delivered · ${(response.latency_ms ?? 0).toFixed(0)} ms`
          : (response.error ?? `Failed${response.status_code === undefined ? "" : ` · HTTP ${String(response.status_code)}`}`),
      })
    } catch (error) {
      toastApiError(error, "Couldn't run the test — try again.")
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${destination.name}”? Routes that send here stop working until you point them somewhere else.`)) return
    try {
      await deleteDestination.mutateAsync(destination.id)
      toast.success(`${destination.name} deleted.`)
    } catch (error) {
      toastApiError(error, "Couldn't delete that destination — try again.")
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border/70 bg-card px-5 py-4 shadow-xs",
        "transition-[transform,box-shadow] duration-(--duration-quick) ease-(--ease-smooth-out)",
        "hover:-translate-y-px hover:shadow-md",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("size-2 shrink-0 rounded-full", health.dot)} aria-label={health.label} role="img" />
            </TooltipTrigger>
            <TooltipContent side="top">{health.label}</TooltipContent>
          </Tooltip>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {typeMeta !== undefined && <typeMeta.icon className="size-[18px]" />}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-medium">{destination.name}</span>
              <Badge variant="muted" className="shrink-0">
                {typeMeta?.label ?? destination.type}
              </Badge>
            </div>
            <span className="truncate text-sm text-muted-foreground" title={summary}>
              {summary}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => void runTest()} disabled={test.isPending} className="gap-1.5">
            {result?.ok === true && <SuccessMark show size={14} />}
            {test.isPending ? "Testing…" : "Test"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => {
              setEditing(true)
            }}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${destination.name}`} onClick={() => void remove()} disabled={deleteDestination.isPending}>
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
      {result !== null && (
        <p className={cn("rounded-md px-2.5 py-1.5 font-mono text-xs", result.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
          {result.detail}
        </p>
      )}

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit destination</SheetTitle>
            <SheetDescription>Changes apply to every route that sends here.</SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-6">
            {editing && (
              <DestinationForm
                destination={destination}
                onSaved={() => {
                  setEditing(false)
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
