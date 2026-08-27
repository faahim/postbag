import { TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * The designed replacement for window.confirm on destructive actions: names the
 * thing being destroyed, says plainly what is kept and what is lost, and makes
 * the destructive choice the styled-but-not-default button.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Keep it",
  pending = false,
  onConfirm,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: ReactNode
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly pending?: boolean
  readonly onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <TriangleAlert className="size-5" />
          </div>
          <DialogTitle className="text-lg tracking-tight">{title}</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-1 gap-2 sm:gap-2.5">
          <Button
            variant="outline"
            autoFocus
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {cancelLabel}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
