import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCount } from "@/lib/format"
import { useCreateStream, useStreams } from "@/lib/queries/streams"

const createBagSchema = z.object({ name: z.string().min(1, "Name your bag.") })

export const Route = createFileRoute("/_app/bags/")({
  component: BagsIndexRoute,
})

function BagsIndexRoute() {
  const streams = useStreams()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bags</h1>
          <p className="text-sm text-muted-foreground">Group forms that should land in one shared shape.</p>
        </div>
        <Button
          onClick={() => {
            setOpen(true)
          }}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          New bag
        </Button>
      </div>

      {streams.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : streams.data === undefined || streams.data.length === 0 ? (
        <EmptyState
          title="No bags yet"
          description="A bag collects submissions from several forms into one normalised shape — useful once you're routing more than one form to the same place."
          action={
            <Button
              onClick={() => {
                setOpen(true)
              }}
            >
              Create a bag
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Sources</TableHead>
              <TableHead className="text-right">Routes</TableHead>
              <TableHead className="text-right">Submissions (30d)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {streams.data.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <Link to="/bags/$bagId" params={{ bagId: s.id }}>
                    {s.name}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{s.id}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(s.counts.sources)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(s.counts.routes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(s.counts.submissions_30d)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateBagDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

function CreateBagDialog({ open, onOpenChange }: { readonly open: boolean; readonly onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const createStream = useCreateStream()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof createBagSchema>>({ resolver: zodResolver(createBagSchema) })

  const onSubmit = handleSubmit(async (values) => {
    const created = await createStream.mutateAsync({ name: values.name })
    toast.success(`${created.name} created.`)
    reset()
    onOpenChange(false)
    await navigate({ to: "/bags/$bagId", params: { bagId: created.id } })
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New bag</DialogTitle>
          <DialogDescription>Attach forms to it once it exists.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void onSubmit(e)
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bag-name">Name</Label>
            <Input id="bag-name" placeholder="Leads" {...register("name")} aria-invalid={errors.name !== undefined} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create bag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
