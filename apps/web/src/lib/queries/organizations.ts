import { useMutation, useQueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/lib/api"

/** Switching organizations invalidates *everything* (job L §3: "the switch sets active org
 * then reloads queries") — every screen's data is org-scoped, so a stale cache after a
 * switch would silently show the old organization's forms, destinations, members, etc. */
export function useSetActiveOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (organizationId: string) =>
      unwrap(await api.POST("/v1/me/active-organization", { body: { organization_id: organizationId } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
    },
  })
}

export function useCreateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { readonly name: string; readonly slug?: string }) =>
      unwrap(await api.POST("/v1/organizations", { body: input })),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
    },
  })
}
