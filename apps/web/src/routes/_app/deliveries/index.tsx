import { createFileRoute } from "@tanstack/react-router"
import { RotateCw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { DeliveryStatusBadge } from "@/components/delivery-status"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDestinations } from "@/lib/queries/destinations"
import { useDeliveries, useRetryDelivery } from "@/lib/queries/deliveries"
import { formatDateTime, formatRelativeTime } from "@/lib/format"
import type { PostmarkStatus } from "@/components/postmark"

export const Route = createFileRoute("/_app/deliveries/")({
  component: DeliveriesRoute,
})

function DeliveriesRoute() {
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [destinationId, setDestinationId] = useState<string | undefined>(undefined)
  const [openId, setOpenId] = useState<string | null>(null)
  const deliveries = useDeliveries({ status, destination: destinationId })
  const destinations = useDestinations()
  const retry = useRetryDelivery()

  const destinationById = new Map((destinations.data ?? []).map((d) => [d.id, d]))
  const open = deliveries.data?.data.find((d) => d.id === openId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Deliveries</h1>
        <p className="text-sm text-muted-foreground">The outbox — every attempt to send a submission somewhere.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status ?? "all"} onValueChange={(v) => { setStatus(v === "all" ? undefined : v) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sending">Sending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="dead">Dead</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={destinationId ?? "all"} onValueChange={(v) => { setDestinationId(v === "all" ? undefined : v) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All destinations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All destinations</SelectItem>
            {(destinations.data ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {deliveries.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : deliveries.data === undefined || deliveries.data.data.length === 0 ? (
        <EmptyState title="No deliveries yet" description="Deliveries appear here the moment a route matches a submission." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead className="text-right">When</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.data.data.map((delivery) => (
              <TableRow
                key={delivery.id}
                className="cursor-pointer"
                onClick={() => {
                  setOpenId(delivery.id)
                }}
              >
                <TableCell>
                  <DeliveryStatusBadge status={delivery.status as PostmarkStatus} />
                </TableCell>
                <TableCell className="text-sm">{destinationById.get(delivery.destination_id)?.name ?? delivery.destination_id}</TableCell>
                <TableCell className="tabular-nums text-sm text-muted-foreground">{delivery.attempts}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                  {delivery.sent_at !== null ? formatRelativeTime(delivery.sent_at) : formatRelativeTime(delivery.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  {(delivery.status === "failed" || delivery.status === "dead") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Retry"
                      onClick={(e) => {
                        e.stopPropagation()
                        retry.mutate(delivery.id, {
                          onSuccess: () => {
                            toast.success("Retry queued.")
                          },
                        })
                      }}
                    >
                      <RotateCw className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={openId !== null} onOpenChange={(o) => { if (!o) setOpenId(null) }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{open?.id}</DialogTitle>
            <DialogDescription>
              {open !== undefined && `${open.attempts} attempt${open.attempts === 1 ? "" : "s"} · created ${formatDateTime(open.created_at)}`}
            </DialogDescription>
          </DialogHeader>
          {open !== undefined && (
            <div className="flex flex-col gap-4">
              <DeliveryStatusBadge status={open.status as PostmarkStatus} />
              {open.last_error !== null && <p className="text-sm text-destructive">{open.last_error}</p>}
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Payload</h3>
                <pre className="max-h-64 overflow-auto rounded-lg border border-border/70 bg-muted/50 p-3 font-mono text-xs">
                  <code>{JSON.stringify(open.payload, null, 2)}</code>
                </pre>
              </div>
              {open.last_response !== undefined && (
                <div className="flex flex-col gap-1">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Last response</h3>
                  <pre className="max-h-40 overflow-auto rounded-lg border border-border/70 bg-muted/50 p-3 font-mono text-xs">
                    <code>{JSON.stringify(open.last_response, null, 2)}</code>
                  </pre>
                </div>
              )}
              {(open.status === "failed" || open.status === "dead") && (
                <Button
                  variant="outline"
                  className="self-start gap-1.5"
                  onClick={() => {
                    retry.mutate(open.id, {
                      onSuccess: () => {
                        toast.success("Retry queued.")
                      },
                    })
                  }}
                >
                  <RotateCw className="size-4" />
                  Retry
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
