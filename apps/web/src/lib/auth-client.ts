import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

/** Better Auth session client. Same-origin always (see lib/api.ts), so no baseURL override
 * is needed — it defaults to `window.location.origin`. */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
})

export const { useSession, signIn, signUp, signOut } = authClient

type SessionSnapshot = {
  readonly data: unknown
  readonly isPending: boolean
  readonly isRefetching: boolean
}

/** The shared session store behind `useSession()`; `atoms` is typed `Record<string, WritableAtom<any>>`
 * upstream, so we pin the slice we read. */
const sessionStore = authClient.$store.atoms["session"] as
  | { get(): SessionSnapshot; listen(listener: (value: SessionSnapshot) => void): () => void }
  | undefined

/**
 * Resolve once the shared session store actually holds the signed-in session.
 *
 * Better Auth refreshes that store on a `setTimeout(…, 10)` *after* `signIn.email()` /
 * `signUp.email()` resolve (`better-auth/client/proxy` — "to avoid race conditions we set the
 * signal in a setTimeout"). Navigating the instant the call returns lets the `/` and `/_app`
 * guards read the stale "no session" and bounce the user straight back to the sign-in page —
 * the "first sign-in does nothing, second works" bug. So after a successful sign-in we poke the
 * signal ourselves and wait for the store to settle with a session. Bounded: on a slow network
 * this degrades to the old behaviour rather than hanging the form.
 *
 * Returns true when the store holds a session, false on timeout.
 */
export function waitForSession(timeoutMs = 5000): Promise<boolean> {
  if (sessionStore === undefined) return Promise.resolve(false)
  const store = sessionStore
  return new Promise((resolve) => {
    let settled = false
    const check = (snapshot: SessionSnapshot) => {
      if (snapshot.data !== null && snapshot.data !== undefined && !snapshot.isRefetching) finish(true)
    }
    // Subscribing mounts the store (first subscriber triggers a fetch); the notify covers the
    // already-mounted case. A doubled fetch is harmless — the store aborts the older one.
    const unsubscribe = store.listen(check)
    const timer = setTimeout(() => {
      finish(false)
    }, timeoutMs)
    function finish(ok: boolean) {
      if (settled) return
      settled = true
      unsubscribe()
      clearTimeout(timer)
      resolve(ok)
    }
    authClient.$store.notify("$sessionSignal")
    check(store.get())
  })
}
