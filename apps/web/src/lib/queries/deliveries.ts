import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { components } from "@postbag/sdk"

import { api, unwrap, type Paginated } from "@/lib/api"

export type Delivery = components["schemas"]["Delivery"]

export type DeliveryListParams = {
  readonly status?: string | undefined
  readonly route?: string | undefined
  readonly destination?: string | undefined
  readonly submission?: string | undefined
}

export function useDeliveries(params: DeliveryListParams = {}) {
  return useQuery<Paginated<Delivery>>({
    queryKey: ["deliveries", params],
    queryFn: async (): Promise<Paginated<Delivery>> =>
      unwrap(await api.GET("/v1/deliveries", { params: { query: { ...params, limit: 50 } as unknown as never } })),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })
}

export function useRetryDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (deliveryId: string): Promise<Delivery> =>
      unwrap(await api.POST("/v1/deliveries/{deliveryId}/retry", { params: { path: { deliveryId } } })),
    onMutate: async (deliveryId) => {
      await queryClient.cancelQueries({ queryKey: ["deliveries"] })
      const previous = queryClient.getQueriesData<Paginated<Delivery>>({ queryKey: ["deliveries"] })
      queryClient.setQueriesData<Paginated<Delivery>>({ queryKey: ["deliveries"] }, (old) => {
        if (old === undefined) return old
        return { ...old, data: old.data.map((d) => (d.id === deliveryId ? { ...d, status: "pending" as const } : d)) }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deliveries"] })
    },
  })
}
