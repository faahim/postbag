import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateOrganization } from "@/lib/queries/organizations"

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  const createOrganization = useCreateOrganization()
  const [name, setName] = useState("")

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) setName("")
  }

  async function create() {
    if (name.trim().length === 0) return
    try {
      const created = await createOrganization.mutateAsync({ name: name.trim() })
      toast.success(`Switched to ${created.name}.`)
      close(false)
    } catch {
      toast.error("Couldn't create the organization — try again.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New organization</DialogTitle>
          <DialogDescription>You'll be its owner. You can invite others once it's created.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-create-name">Name</Label>
            <Input
              id="org-create-name"
              autoFocus
              placeholder="Acme Inc."
              value={name}
              onChange={(e) => {
                setName(e.target.value)
              }}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createOrganization.isPending || name.trim().length === 0}>
              {createOrganization.isPending ? "Creating…" : "Create organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
