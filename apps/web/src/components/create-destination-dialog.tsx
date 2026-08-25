import { DestinationForm } from "@/components/destination-form"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function CreateDestinationDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Destination</DialogTitle>
          <DialogDescription>Somewhere submissions can be sent.</DialogDescription>
        </DialogHeader>
        <DestinationForm
          onSaved={() => {
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
