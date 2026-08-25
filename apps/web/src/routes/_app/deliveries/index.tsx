import { createFileRoute } from "@tanstack/react-router"
import { RotateCw } from "lucide-react"
import { useState, type CSSProperties } from "react"
import { toast } from "sonner"

import { DeliveryStatusBadge } from "@/components/delivery-status"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDestinations } from "@/lib/queries/destinations"
import { useDeliveries, useRetryDelivery } from "@/lib/queries/deliveries"
import { formatDateTime, formatRelativeTime } from "@/lib/format"
import type { RoutingMarkStatus } from "@/components/routing-mark"

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
    <div className="page-enter flex flex-col gap-8">
      <PageHeader title="Deliveries" description="Every attempt to send a Submission somewhere, tries and retries included." />

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
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : deliveries.data === undefined || deliveries.data.data.length === 0 ? (
        <EmptyState
          title="No Deliveries yet"
          description="The moment a Route matches a Submission, the attempt shows up here — and keeps showing up until it lands."
        />
      ) : (
        <div className="list-surface">
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
            {deliveries.data.data.map((delivery, i) => (
              <TableRow
                key={delivery.id}
                className="row-enter cursor-pointer"
                style={{ "--row-index": i } as CSSProperties}
                onClick={() => {
                  setOpenId(delivery.id)
                }}
              >
                <TableCell>
                  <DeliveryStatusBadge status={delivery.status as RoutingMarkStatus} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-[15px] font-medium">
                      {destinationById.get(delivery.destination_id)?.name ?? delivery.destination_id}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{delivery.destination_id}</span>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-sm text-muted-foreground">{delivery.attempts}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
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
        </div>
      )}

      <Dialog open={openId !== null} onOpenChange={(o) => { if (!o) setOpenId(null) }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg tracking-tight">
              {open !== undefined
                ? `Delivery to ${destinationById.get(open.destination_id)?.name ?? open.destination_id}`
                : "Delivery"}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {open !== undefined && (
                <>
                  <span className="font-mono text-xs">{open.id}</span>
                  <span>{`${open.attempts.toString()} attempt${open.attempts === 1 ? "" : "s"} · created ${formatDateTime(open.created_at)}`}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {open !== undefined && (
            <div className="flex flex-col gap-4">
              <DeliveryStatusBadge status={open.status as RoutingMarkStatus} />
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
