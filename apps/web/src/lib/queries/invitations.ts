import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { components } from "@postbag/sdk"

import { api, unwrap } from "@/lib/api"

export type Invitation = components["schemas"]["Invitation"]
export type PublicInvitation = components["schemas"]["PublicInvitation"]
export type InvitationRole = "admin" | "member"

export function useInvitations() {
  return useQuery<readonly Invitation[]>({
    queryKey: ["invitations"],
    queryFn: async (): Promise<readonly Invitation[]> => unwrap(await api.GET("/v1/invitations")),
  })
}

export function useCreateInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { readonly email: string; readonly role: InvitationRole }) =>
      unwrap(await api.POST("/v1/invitations", { body: input })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invitations"] })
    },
  })
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.DELETE("/v1/invitations/{id}", { params: { path: { id } } })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invitations"] })
    },
  })
}

/** Public — no session or API key required, so the accept page can render for a signed-out
 * visitor. `enabled: id !== undefined` guards the brief moment before the route param is
 * available. */
export function usePublicInvitation(id: string | undefined) {
  return useQuery<PublicInvitation>({
    queryKey: ["invitations", "public", id],
    queryFn: async (): Promise<PublicInvitation> => {
      if (id === undefined) throw new Error("Missing invitation id.")
      return unwrap(await api.GET("/v1/invitations/{id}", { params: { path: { id } } }))
    },
    enabled: id !== undefined,
    retry: false,
  })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await api.POST("/v1/invitations/{id}/accept", { params: { path: { id } } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
    },
  })
}
