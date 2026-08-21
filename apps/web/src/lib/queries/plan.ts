import { useMutation, useQueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/lib/api"

/** Job K — redeeming invalidates `me` so every screen reading plan/limits (topbar, this
 * card, /v1/me itself) updates in place; the card never mutates local state for the
 * result, it just refetches the same source of truth every other screen reads. */
export function useRedeemPlanCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => unwrap(await api.POST("/v1/plan/redeem", { body: { code } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] })
    },
  })
}
