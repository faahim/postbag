import { useMutation, useQuery } from "@tanstack/react-query"
import type { operations } from "@postbag/sdk"

import { api, unwrap } from "@/lib/api"

export type SandboxStatus =
  operations["public_sandboxes_get"]["responses"][200]["content"]["application/json"]
export type SandboxClaim =
  operations["sandboxes_claim"]["responses"][200]["content"]["application/json"]

export function useAnonymousSandbox(id: string | null, token: string | null) {
  return useQuery<SandboxStatus>({
    queryKey: ["anonymous-sandbox", id],
    enabled: id !== null && token !== null,
    queryFn: async () => {
      if (id === null || token === null) throw new Error("Missing sandbox capability.")
      return unwrap(
        await api.GET("/v1/public/sandboxes/{id}", {
          params: {
            path: { id },
            header: { authorization: `Sandbox ${token}` },
          },
        }),
      )
    },
    retry: false,
    staleTime: 0,
  })
}

export function useClaimAnonymousSandbox() {
  return useMutation<SandboxClaim, Error, { readonly id: string; readonly token: string }>({
    mutationFn: async ({ id, token }) =>
      unwrap(
        await api.POST("/v1/sandboxes/{id}/claim", {
          params: {
            path: { id },
            header: { "postbag-sandbox-token": token },
          },
        }),
      ),
  })
}
