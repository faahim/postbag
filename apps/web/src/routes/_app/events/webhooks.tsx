import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronDown, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { EmptyState } from "@/components/empty-state"
import { RoutingMark, type RoutingMarkStatus } from "@/components/routing-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { toastApiError } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import {
  SYSTEM_EVENT_GROUPS,
  useCreateSystemWebhook,
  useDeleteSystemWebhook,
  useSystemWebhookDeliveries,
  useSystemWebhooks,
  useUpdateSystemWebhook,
  type SystemEventType,
  type SystemWebhook,
} from "@/lib/queries/webhooks"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_app/events/webhooks")({
  component: EventWebhooksRoute,
})

const ALL_EVENTS: readonly SystemEventType[] = SYSTEM_EVENT_GROUPS.flatMap((g) => g.events)

const HEALTH = {
  ok: { dot: "bg-success", label: "Healthy" },
  failing: { dot: "bg-destructive", label: "Failing" },
  unknown: { dot: "bg-muted-foreground/40", label: "No deliveries yet" },
} as const

function EventWebhooksRoute() {
  const webhooks = useSystemWebhooks()
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Event webhooks</h2>
          <p className="max-w-xl text-sm text-muted-foreground text-pretty">
            Get a signed HTTP call whenever one of these events happens — a submission arrives, a delivery fails, a schema changes.
            They notify your own code, a Zap or a bot about the workspace.
          </p>
          <p className="max-w-xl text-xs text-muted-foreground text-pretty">
            Want the submissions themselves delivered to your endpoint? That's a{" "}
            <Link to="/destinations" className="font-medium text-foreground underline-offset-4 hover:underline">
              webhook destination
            </Link>
            , not an event webhook.
          </p>
        </div>
        {!adding && (
          <Button
            onClick={() => {
              setAdding(true)
            }}
            className="shrink-0 gap-1.5"
          >
            <Plus className="size-4" />
            Add webhook
          </Button>
        )}
      </div>

      {adding && (
        <NewWebhookCard
          onDone={() => {
            setAdding(false)
          }}
        />
      )}

      {webhooks.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : webhooks.data === undefined || webhooks.data.length === 0 ? (
        !adding && (
          <EmptyState
            title="No event webhooks yet"
            description="Add one to be told about new submissions, failed deliveries or schema changes — your own code, a Zap, a Slack bot."
            action={
              <Button
                onClick={() => {
                  setAdding(true)
                }}
              >
                Add a webhook
              </Button>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-2">
          {webhooks.data.map((hook) => (
            <WebhookRow key={hook.id} hook={hook} />
          ))}
        </div>
      )}
    </div>
  )
}

const newWebhookSchema = z.object({
  url: z.url("Enter a valid https:// URL."),
  secret: z.string().optional(),
})

function NewWebhookCard({ onDone }: { readonly onDone: () => void }) {
  const create = useCreateSystemWebhook()
  const [events, setEvents] = useState<ReadonlySet<SystemEventType>>(new Set(["submission.received"]))
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof newWebhookSchema>>({ resolver: zodResolver(newWebhookSchema) })

  function toggle(event: SystemEventType, on: boolean) {
    setEvents((current) => {
      const next = new Set(current)
      if (on) next.add(event)
      else next.delete(event)
      return next
    })
  }

  const onSubmit = handleSubmit(async (values) => {
    if (events.size === 0) {
      toast.error("Pick at least one event.")
      return
    }
    try {
      await create.mutateAsync({
        url: values.url,
        events: [...events],
        ...(values.secret !== undefined && values.secret.length > 0 ? { secret: values.secret } : {}),
      })
      toast.success("Webhook added.", { description: "We'll start calling it on the next matching event." })
      onDone()
    } catch (error) {
      toastApiError(error, "Couldn't add the webhook — try again.")
    }
  })

  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-1 duration-(--duration-fast)">
      <CardContent>
        <form
          onSubmit={(e) => {
            void onSubmit(e)
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hook-url">Endpoint URL</Label>
            <Input id="hook-url" placeholder="https://example.com/postbag-events" {...register("url")} aria-invalid={errors.url !== undefined} />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label>Events</Label>
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setEvents(new Set(ALL_EVENTS))
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setEvents(new Set())
                  }}
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {SYSTEM_EVENT_GROUPS.map((group) => (
                <div key={group.label} className="flex flex-col gap-1.5 rounded-lg border border-border/70 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
                  {group.events.map((event) => (
                    <label key={event} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={events.has(event)}
                        onCheckedChange={(checked) => {
                          toggle(event, checked === true)
                        }}
                      />
                      <span className="font-mono text-xs">{event}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hook-secret">
              Signing secret <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="hook-secret" placeholder="Used to sign the X-Postbag-Signature header" {...register("secret")} />
            <p className="text-xs text-muted-foreground">Verify the HMAC-SHA256 signature on your side so only Postbag can call this URL.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add webhook"}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function WebhookRow({ hook }: { readonly hook: SystemWebhook }) {
  const update = useUpdateSystemWebhook()
  const remove = useDeleteSystemWebhook()
  const [open, setOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const health = HEALTH[hook.health ?? "unknown"]
  const enabled = hook.enabled ?? true

  let display = hook.url
  try {
    const parsed = new URL(hook.url)
    display = `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`
  } catch {
    // keep the raw url
  }

  async function del() {
    try {
      await remove.mutateAsync(hook.id)
      toast.success("Webhook removed.")
    } catch (error) {
      toastApiError(error, "Couldn't remove the webhook — try again.")
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-border/70 bg-card shadow-xs">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("size-2 shrink-0 rounded-full", health.dot)} title={health.label} />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-mono text-sm" title={hook.url}>
              {display}
            </span>
            <div className="flex flex-wrap gap-1">
              {hook.events.length === ALL_EVENTS.length ? (
                <Badge variant="muted">all events</Badge>
              ) : (
                hook.events.map((event) => (
                  <Badge key={event} variant="muted" className="font-mono">
                    {event}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={enabled}
            aria-label={enabled ? "Pause webhook" : "Resume webhook"}
            onCheckedChange={(checked) => {
              update.mutate(
                { webhookId: hook.id, body: { enabled: checked } },
                {
                  onError: (error) => {
                    toastApiError(error, "Couldn't update the webhook — try again.")
                  },
                },
              )
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={() => {
              setOpen((o) => !o)
            }}
            aria-expanded={open}
          >
            Deliveries
            <ChevronDown className={cn("size-3.5 transition-transform duration-(--duration-quick)", open && "rotate-180")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove webhook"
            onClick={() => {
              setConfirmRemove(true)
            }}
            disabled={remove.isPending}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove the webhook for ${display}?`}
        description="It stops receiving events immediately. Past deliveries are kept in the log."
        confirmLabel="Remove webhook"
        pending={remove.isPending}
        onConfirm={() => void del()}
      />
      {open && <DeliveriesPanel webhookId={hook.id} />}
    </div>
  )
}

function DeliveriesPanel({ webhookId }: { readonly webhookId: string }) {
  const deliveries = useSystemWebhookDeliveries(webhookId)
  const rows = deliveries.data?.data ?? []

  return (
    <div className="border-t border-border/70 px-4 py-3 animate-in fade-in-0 duration-(--duration-quick)">
      {deliveries.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing sent yet — the first matching event will show up here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {rows.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <RoutingMark status={d.status as RoutingMarkStatus} size={16} />
                <span className="font-mono">{d.event_type}</span>
                {d.last_error !== null && <span className="truncate text-destructive">{d.last_error}</span>}
              </div>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {d.attempts} {d.attempts === 1 ? "attempt" : "attempts"} · {formatRelativeTime(d.sent_at ?? d.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
