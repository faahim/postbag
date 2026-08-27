import { useQuery } from "@tanstack/react-query"

import { api, unwrap } from "@/lib/api"

/** The one shared read every screen that needs the active org, plan, key scopes or the
 * caller's organization list goes through — same `["me"]` query key everywhere (topbar,
 * settings, plan card, org switcher) so a single invalidation refreshes them all. */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => unwrap(await api.GET("/v1/me")),
  })
}
