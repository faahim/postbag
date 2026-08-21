import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { BagExplainer } from "@/components/bag-explainer"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCount } from "@/lib/format"
import { useCreateStream, useStreams } from "@/lib/queries/streams"

const createBagSchema = z.object({ name: z.string().trim().min(1, "Give the bag a name.") })

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
          <p className="text-sm text-muted-foreground">Collect several forms into one shape, and send them on together.</p>
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
        <BagExplainer
          title="Many forms in. One tidy shape out."
          lede="Say the same contact form lives on three of your sites, and each one names its fields a little differently — fullName, name, Namn. A bag takes everything those forms receive and lines it up into one shape, so wherever you send it — an inbox, Telegram, a webhook — the same fields always arrive in the same places."
          action={
            <Button
              onClick={() => {
                setOpen(true)
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Create your first bag
            </Button>
          }
          aside="Only one form? You don't need a bag yet — route it straight from its own page. Bags earn their keep once two or more forms should land in the same place."
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
          <DialogDescription>Name it after what lands in it — “Leads”, “Support requests”. You'll attach the first form next.</DialogDescription>
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
