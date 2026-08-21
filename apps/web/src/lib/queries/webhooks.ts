import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { components, operations } from "@postbag/sdk"

import { api, unwrap, type Paginated } from "@/lib/api"

export type SystemWebhook = components["schemas"]["SystemWebhook"]
export type SystemWebhookDelivery = components["schemas"]["SystemWebhookDelivery"]
export type SystemWebhookInput = NonNullable<operations["webhooks_create"]["requestBody"]>["content"]["application/json"]
export type SystemEventType = SystemWebhookInput["events"][number]

/** Every event an organization-level webhook can subscribe to, grouped the way people think
 * about them. Mirrors `EventTypeSchema` in @postbag/core (type-checked against the SDK union,
 * so a new event upstream fails the build here rather than silently going un-offered). */
export const SYSTEM_EVENT_GROUPS: readonly { readonly label: string; readonly events: readonly SystemEventType[] }[] = [
  { label: "Submissions", events: ["submission.received", "submission.quarantined", "submission.spam"] },
  { label: "Deliveries", events: ["delivery.sent", "delivery.failed", "delivery.dead", "digest.ready"] },
  { label: "Forms & bags", events: ["form.created", "form.schema.changed", "stream.schema.changed", "drift.detected", "drift.resolved"] },
  { label: "Destinations", events: ["destination.failing", "destination.recovered"] },
]

export function useSystemWebhooks() {
  return useQuery<readonly SystemWebhook[]>({
    queryKey: ["webhooks"],
    queryFn: async (): Promise<readonly SystemWebhook[]> => unwrap(await api.GET("/v1/webhooks")),
  })
}

export function useCreateSystemWebhook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: SystemWebhookInput): Promise<SystemWebhook> =>
      unwrap(await api.POST("/v1/webhooks", { body })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["webhooks"] })
    },
  })
}

export function useUpdateSystemWebhook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ webhookId, body }: { readonly webhookId: string; readonly body: Partial<SystemWebhookInput> }): Promise<SystemWebhook> =>
      unwrap(await api.PATCH("/v1/webhooks/{webhookId}", { params: { path: { webhookId } }, body: body as unknown as never })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["webhooks"] })
    },
  })
}

export function useDeleteSystemWebhook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (webhookId: string): Promise<void> => {
      const result = await api.DELETE("/v1/webhooks/{webhookId}", { params: { path: { webhookId } } })
      if (result.error !== undefined) unwrap(result)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["webhooks"] })
    },
  })
}

export function useSystemWebhookDeliveries(webhookId: string | undefined) {
  return useQuery<Paginated<SystemWebhookDelivery>>({
    queryKey: ["webhooks", webhookId, "deliveries"],
    queryFn: async (): Promise<Paginated<SystemWebhookDelivery>> =>
      unwrap(await api.GET("/v1/webhooks/{webhookId}/deliveries", { params: { path: { webhookId: webhookId ?? "" }, query: { limit: 20 } } })),
    enabled: webhookId !== undefined,
  })
}
