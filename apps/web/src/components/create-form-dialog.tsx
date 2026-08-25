import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateForm } from "@/lib/queries/forms"

const createFormSchema = z.object({
  name: z.string().min(1, "Name your Form."),
  origin: z.union([z.url(), z.literal("")]).optional(),
})
type CreateFormValues = z.infer<typeof createFormSchema>

export function CreateFormDialog({ open, onOpenChange }: { readonly open: boolean; readonly onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const createForm = useCreateForm()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({ resolver: zodResolver(createFormSchema) })

  const onSubmit = handleSubmit(async (values) => {
    const settings = values.origin !== undefined && values.origin !== "" ? { allowed_origins: [values.origin] } : undefined
    const created = await createForm.mutateAsync({ name: values.name, ...(settings ? { settings } : {}) })
    toast.success(`${created.name} created.`)
    reset()
    onOpenChange(false)
    await navigate({ to: "/forms/$formId", params: { formId: created.id } })
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Form</DialogTitle>
          <DialogDescription>Gets a live endpoint immediately — wire up delivery after.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void onSubmit(e)
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-form-name">Name</Label>
            <Input id="create-form-name" placeholder="Waitlist signup" {...register("name")} aria-invalid={errors.name !== undefined} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-form-origin">
              Allowed origin <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="create-form-origin" placeholder="https://example.com" {...register("origin")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create Form"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
