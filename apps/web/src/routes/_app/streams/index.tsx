import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { MoreHorizontal, Plus } from "lucide-react"
import { useState, type CSSProperties } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { PageHeader } from "@/components/page-header"
import { StreamExplainer } from "@/components/stream-explainer"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCount } from "@/lib/format"
import { toastApiError } from "@/lib/api"
import { useCreateStream, useDeleteStream, useStreams, useUpdateStream, type Stream } from "@/lib/queries/streams"

const createStreamSchema = z.object({ name: z.string().trim().min(1, "Give the Stream a name.") })

export const Route = createFileRoute("/_app/streams/")({
  component: StreamsIndexRoute,
})

function StreamsIndexRoute() {
  const streams = useStreams()
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState<Stream | undefined>(undefined)

  return (
    <div className="page-enter flex flex-col gap-8">
      <PageHeader
        title="Streams"
        description="Collect several Forms into one shape, and send them on together."
        actions={
          <Button
            onClick={() => {
              setOpen(true)
            }}
          >
            <Plus />
            New Stream
          </Button>
        }
      />

      {streams.isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : streams.data === undefined || streams.data.length === 0 ? (
        <StreamExplainer
          title="Many forms in. One tidy shape out."
          lede="Say the same contact Form lives on three of your sites, and each one names its fields a little differently — fullName, name, Namn. A Stream takes everything those Forms receive and lines it up into one shape, so wherever you send it — an inbox, Telegram, a webhook — the same fields always arrive in the same places."
          action={
            <Button
              onClick={() => {
                setOpen(true)
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Create your first Stream
            </Button>
          }
          aside="Only one Form? You don't need a Stream yet — route it straight from its own page. Streams earn their keep once two or more Forms should land in the same place."
        />
      ) : (
        <div className="list-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stream</TableHead>
                <TableHead className="text-right">Sources</TableHead>
                <TableHead className="text-right">Routes</TableHead>
                <TableHead className="text-right">Submissions (30d)</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {streams.data.map((s, i) => (
                <TableRow key={s.id} className="row-enter" style={{ "--row-index": i } as CSSProperties}>
                  <TableCell>
                    <Link to="/streams/$streamId" params={{ streamId: s.id }} className="flex flex-col gap-1 outline-none">
                      <span className="text-[15px] font-medium">{s.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-[15px] tabular-nums">{formatCount(s.counts.sources)}</TableCell>
                  <TableCell className="text-right text-[15px] tabular-nums">{formatCount(s.counts.routes)}</TableCell>
                  <TableCell className="text-right text-[15px] tabular-nums">{formatCount(s.counts.submissions_30d)}</TableCell>
                  <TableCell className="text-right">
                    <StreamRowMenu
                      stream={s}
                      onRename={() => {
                        setRenaming(s)
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateStreamDialog open={open} onOpenChange={setOpen} />
      <RenameStreamDialog
        stream={renaming}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRenaming(undefined)
        }}
      />
    </div>
  )
}

function CreateStreamDialog({ open, onOpenChange }: { readonly open: boolean; readonly onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const createStream = useCreateStream()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof createStreamSchema>>({ resolver: zodResolver(createStreamSchema) })

  const onSubmit = handleSubmit(async (values) => {
    const created = await createStream.mutateAsync({ name: values.name })
    toast.success(`${created.name} created.`)
    reset()
    onOpenChange(false)
    await navigate({ to: "/streams/$streamId", params: { streamId: created.id } })
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Stream</DialogTitle>
          <DialogDescription>Name it after what lands in it — “Leads”, “Support requests”. You'll attach the first Form next.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void onSubmit(e)
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stream-name">Name</Label>
            <Input id="stream-name" placeholder="Leads" {...register("name")} aria-invalid={errors.name !== undefined} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create Stream"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StreamRowMenu({ stream, onRename }: { readonly stream: Stream; readonly onRename: () => void }) {
  const navigate = useNavigate()
  const deleteStream = useDeleteStream()

  async function remove() {
    const routes = stream.counts.routes
    const detail = routes > 0 ? ` Its ${routes} ${routes === 1 ? "route stops" : "routes stop"} delivering.` : ""
    if (!window.confirm(`Delete “${stream.name}”? The Forms in it and their Submissions are kept; only the Stream goes.${detail}`)) return
    try {
      await deleteStream.mutateAsync(stream.id)
      toast.success(`${stream.name} deleted.`)
    } catch (error) {
      toastApiError(error, "Couldn't delete that Stream — try again.")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`Actions for ${stream.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void navigate({ to: "/streams/$streamId", params: { streamId: stream.id } })}>Open</DropdownMenuItem>
        <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void remove()}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const renameStreamSchema = z.object({ name: z.string().trim().min(1, "Give the Stream a name.") })

export function RenameStreamDialog({ stream, onOpenChange }: { readonly stream: Stream | undefined; readonly onOpenChange: (open: boolean) => void }) {
  const updateStream = useUpdateStream(stream?.id ?? "")
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof renameStreamSchema>>({ resolver: zodResolver(renameStreamSchema), values: { name: stream?.name ?? "" } })

  const onSubmit = handleSubmit(async (values) => {
    if (stream === undefined) return
    try {
      await updateStream.mutateAsync({ name: values.name })
      toast.success(`Renamed to ${values.name}.`)
      onOpenChange(false)
    } catch (error) {
      toastApiError(error, "Couldn't rename the Stream — try again.")
    }
  })

  return (
    <Dialog open={stream !== undefined} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Stream</DialogTitle>
          <DialogDescription>Routes, Forms and the Stream id stay exactly as they are.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void onSubmit(e)
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-stream-name">Name</Label>
            <Input id="rename-stream-name" {...register("name")} aria-invalid={errors.name !== undefined} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save name"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
