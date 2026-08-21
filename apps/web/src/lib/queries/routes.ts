import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"
import type { RouteInputSchema } from "@postbag/core"
import type { components } from "@postbag/sdk"

import { api, unwrap, type Paginated } from "@/lib/api"

export type Route = components["schemas"]["Route"]
export type RouteInput = z.input<typeof RouteInputSchema>

export function useRoutes(params: { readonly form?: string; readonly stream?: string; readonly destination?: string } = {}) {
  return useQuery<Paginated<Route>>({
    queryKey: ["routes", params],
    queryFn: async (): Promise<Paginated<Route>> =>
      unwrap(await api.GET("/v1/routes", { params: { query: { ...params, limit: 100 } } })),
  })
}

export function useCreateRoute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: RouteInput): Promise<Route> =>
      unwrap(await api.POST("/v1/routes", { body: body as unknown as never })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["routes"] })
      await queryClient.invalidateQueries({ queryKey: ["forms"] })
    },
  })
}

export function useUpdateRoute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ routeId, body }: { readonly routeId: string; readonly body: Record<string, unknown> }): Promise<Route> =>
      unwrap(await api.PATCH("/v1/routes/{routeId}", { params: { path: { routeId } }, body })),
    onMutate: async ({ routeId, body }) => {
      await queryClient.cancelQueries({ queryKey: ["routes"] })
      const previous = queryClient.getQueriesData<Paginated<Route>>({ queryKey: ["routes"] })
      queryClient.setQueriesData<Paginated<Route>>({ queryKey: ["routes"] }, (old) => {
        if (old === undefined) return old
        return { ...old, data: old.data.map((r) => (r.id === routeId ? { ...r, ...body } : r)) }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["routes"] })
    },
  })
}

export function useDeleteRoute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (routeId: string) => {
      await api.DELETE("/v1/routes/{routeId}", { params: { path: { routeId } } })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["routes"] })
      await queryClient.invalidateQueries({ queryKey: ["forms"] })
    },
  })
}
