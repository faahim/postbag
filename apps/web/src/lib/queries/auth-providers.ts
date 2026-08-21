import { useQuery } from "@tanstack/react-query"
import type { operations } from "@postbag/sdk"

import { api, unwrap } from "@/lib/api"

export type AuthProviders = operations["auth_providers"]["responses"][200]["content"]["application/json"]
export type SocialProvider = AuthProviders["social"][number]

/** GET /v1/auth/providers is public and server-cached for 60s, and which sign-in methods
 * this instance has configured never changes without a restart — `staleTime: Infinity` so
 * the sign-in and sign-up screens only ever fetch it once per session (job G 2a). */
export function useAuthProviders() {
  return useQuery<AuthProviders>({
    queryKey: ["auth-providers"],
    queryFn: async (): Promise<AuthProviders> => unwrap(await api.GET("/v1/auth/providers")),
    staleTime: Infinity,
  })
}
