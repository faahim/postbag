import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { authClient } from "@/lib/auth-client"
import type { SocialProvider } from "@/lib/queries/auth-providers"

export type LinkedAccount = {
  readonly id: string
  readonly providerId: string
  readonly accountId: string
  readonly createdAt: string
}

const QUERY_KEY = ["linked-accounts"]

/** Better Auth's `/list-accounts` also returns the `credential` (email+password) account
 * as a row, which is how "Disconnect" below knows whether removing a social account would
 * leave the user with no way to sign in at all. */
export function useLinkedAccounts() {
  return useQuery<readonly LinkedAccount[]>({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<readonly LinkedAccount[]> => {
      const { data, error } = await authClient.listAccounts()
      if (error) throw new Error(error.message ?? "Could not load connected accounts.")
      return data.map((account) => ({
        id: account.id,
        providerId: account.providerId,
        accountId: account.accountId,
        createdAt: account.createdAt instanceof Date ? account.createdAt.toISOString() : String(account.createdAt),
      }))
    },
  })
}

/** `linkSocial` redirects the browser away on success (same as `signIn.social`) — there is
 * nothing to invalidate here; the accounts list picks up the new link once the browser
 * returns to `/app/settings`. */
export function useLinkSocial() {
  return useMutation({
    mutationFn: async (provider: SocialProvider): Promise<void> => {
      const { error } = await authClient.linkSocial({ provider, callbackURL: "/app/settings" })
      if (error) throw new Error(error.message ?? "Could not start the connection.")
    },
  })
}

export function useUnlinkAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (providerId: string): Promise<void> => {
      const { error } = await authClient.unlinkAccount({ providerId })
      if (error) throw new Error(error.message ?? "Could not disconnect.")
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
