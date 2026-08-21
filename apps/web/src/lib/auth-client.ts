import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

/** Better Auth session client. Same-origin always (see lib/api.ts), so no baseURL override
 * is needed — it defaults to `window.location.origin`. */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
})

export const { useSession, signIn, signUp, signOut } = authClient
