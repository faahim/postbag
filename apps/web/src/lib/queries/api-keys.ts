import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/lib/api"

export type ApiKeyScope = "manage" | "read" | "submit"

export type ApiKeySummary = {
  readonly id: string
  readonly name: string | null
  readonly prefix: string | null
  readonly scopes: readonly ApiKeyScope[]
  readonly enabled: boolean
  readonly created_at: string
}

// The create response doesn't echo `enabled` (a freshly created key always is).
export type ApiKeyCreated = Omit<ApiKeySummary, "enabled"> & { readonly key: string }

export function useApiKeys() {
  return useQuery<readonly ApiKeySummary[]>({
    queryKey: ["api-keys"],
    queryFn: async (): Promise<readonly ApiKeySummary[]> => unwrap(await api.GET("/v1/api-keys")),
  })
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { readonly name?: string; readonly scopes: readonly ApiKeyScope[] }): Promise<ApiKeyCreated> =>
      unwrap(await api.POST("/v1/api-keys", { body: { ...body, scopes: [...body.scopes] } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] })
    },
  })
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.DELETE("/v1/api-keys/{id}", { params: { path: { id } } })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] })
    },
  })
}
