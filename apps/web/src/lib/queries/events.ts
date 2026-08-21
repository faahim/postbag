import { useQuery } from "@tanstack/react-query"
import type { components } from "@postbag/sdk"

import { api, unwrap, type Paginated } from "@/lib/api"

export type Event = components["schemas"]["Event"]

export function useEvents(params: { readonly type?: string } = {}) {
  return useQuery<Paginated<Event>>({
    queryKey: ["events", params],
    queryFn: async (): Promise<Paginated<Event>> =>
      unwrap(await api.GET("/v1/events", { params: { query: { ...params, limit: 50 } } })),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })
}
