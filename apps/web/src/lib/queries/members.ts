import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { components } from "@postbag/sdk"

import { api, unwrap } from "@/lib/api"

export type Member = components["schemas"]["Member"]
export type MemberRole = Member["role"]

export function useMembers() {
  return useQuery<readonly Member[]>({
    queryKey: ["members"],
    queryFn: async (): Promise<readonly Member[]> => unwrap(await api.GET("/v1/members")),
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ memberId, role }: { readonly memberId: string; readonly role: MemberRole }) =>
      unwrap(await api.PATCH("/v1/members/{memberId}", { params: { path: { memberId } }, body: { role } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["members"] })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (memberId: string) => {
      await api.DELETE("/v1/members/{memberId}", { params: { path: { memberId } } })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["members"] })
      await queryClient.invalidateQueries({ queryKey: ["me"] })
    },
  })
}
