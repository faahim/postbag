import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"
import type { DestinationInputSchema } from "@postbag/core"
import type { components } from "@postbag/sdk"

import { api, unwrap, type Paginated } from "@/lib/api"

export type Destination = components["schemas"]["Destination"]
export type DestinationInput = z.input<typeof DestinationInputSchema>

export function useDestinations() {
  return useQuery<readonly Destination[]>({
    queryKey: ["destinations"],
    queryFn: async (): Promise<readonly Destination[]> => {
      const page: Paginated<Destination> = unwrap(
        await api.GET("/v1/destinations", { params: { query: { limit: 100 } } }),
      )
      return page.data
    },
  })
}

export function useCreateDestination() {
  const queryClient = useQueryClient()
  return useMutation({
    // `body`'s zod-derived type marks optional fields as `T | undefined` explicitly; the
    // generated fetch client's body type omits them entirely when absent (`exactOptionalPropertyTypes`
    // sees those as different types even though they're the same shape at runtime).
    mutationFn: async (body: DestinationInput): Promise<Destination> =>
      unwrap(await api.POST("/v1/destinations", { body: body as unknown as never })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["destinations"] })
      await queryClient.invalidateQueries({ queryKey: ["me"] })
    },
  })
}

export function useTestDestination() {
  return useMutation({
    mutationFn: async (destinationId: string): Promise<components["schemas"]["DeliveryResult"]> =>
      unwrap(await api.POST("/v1/destinations/{destinationId}/test", { params: { path: { destinationId } } })),
  })
}

export function useUpdateDestination() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ destinationId, body }: { readonly destinationId: string; readonly body: Record<string, unknown> }): Promise<Destination> =>
      unwrap(await api.PATCH("/v1/destinations/{destinationId}", { params: { path: { destinationId } }, body })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["destinations"] })
    },
  })
}

export function useDeleteDestination() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (destinationId: string) => {
      await api.DELETE("/v1/destinations/{destinationId}", { params: { path: { destinationId } } })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["destinations"] })
    },
  })
}
