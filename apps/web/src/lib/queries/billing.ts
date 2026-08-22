import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { operations } from "@postbag/sdk"

import { api, unwrap } from "@/lib/api"

export type BillingStatus =
  operations["billing_get"]["responses"][200]["content"]["application/json"]
export type BillingCheckoutInput = NonNullable<
  operations["billing_checkout"]["requestBody"]
>["content"]["application/json"]
type BillingRedirect =
  operations["billing_checkout"]["responses"][201]["content"]["application/json"]
type BillingPortalRedirect =
  operations["billing_portal"]["responses"][201]["content"]["application/json"]

const BILLING_QUERY_KEY = ["billing"] as const

export function useBilling() {
  return useQuery<BillingStatus>({
    queryKey: BILLING_QUERY_KEY,
    queryFn: async (): Promise<BillingStatus> => unwrap(await api.GET("/v1/billing")),
  })
}

export function useBillingCheckout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: BillingCheckoutInput): Promise<BillingRedirect> =>
      unwrap(await api.POST("/v1/billing/checkout", { body })),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
      ])
    },
  })
}

export function useBillingPortal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<BillingPortalRedirect> =>
      unwrap(await api.POST("/v1/billing/portal")),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
      ])
    },
  })
}
