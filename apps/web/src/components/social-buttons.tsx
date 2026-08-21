import { Loader2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { signIn } from "@/lib/auth-client"
import { useAuthProviders, type SocialProvider } from "@/lib/queries/auth-providers"
import { SOCIAL_PROVIDER_BUTTON_LABEL, SOCIAL_PROVIDER_ICON } from "@/lib/social-provider-meta"
import { cn } from "@/lib/utils"

function Divider() {
  return (
    <div className="flex items-center gap-3 py-0.5" aria-hidden="true">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">or</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

/** Shared between sign-in and sign-up (job G 2a/2c) — Better Auth handles both intents
 * through the same `signIn.social` call, so `intent` carries no behavioural split; it is
 * exposed for the caller's own layout/analytics hooks (`data-intent` below). */
export function SocialButtons({ intent, className }: { readonly intent: "sign-in" | "sign-up"; readonly className?: string }) {
  const providers = useAuthProviders()
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null)

  async function handleClick(provider: SocialProvider) {
    setPendingProvider(provider)
    const { error } = await signIn.social({
      provider,
      callbackURL: "/app",
      newUserCallbackURL: "/app?welcome=1",
      errorCallbackURL: "/app/sign-in?error=oauth",
    })
    // On success Better Auth navigates the browser away immediately — nothing left to do
    // here. Only reset the pressed state if the call failed before ever redirecting.
    if (error) setPendingProvider(null)
  }

  // The hosted build always has at least one provider configured, so it's worth reserving
  // the space up front to avoid a layout jump once the request resolves. A self-hosted
  // instance might configure none, so it renders nothing until the real answer arrives —
  // it's cached 60s server-side and same-origin, so this is rarely a visible wait.
  const reserveSpace = import.meta.env.VITE_HOSTED !== undefined

  if (providers.isLoading) {
    if (!reserveSpace) return null
    return (
      <div data-intent={intent} className={cn("flex flex-col gap-2.5", className)}>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Divider />
      </div>
    )
  }

  const social = providers.data?.social ?? []
  if (social.length === 0) return null

  return (
    <div data-intent={intent} className={cn("flex flex-col gap-2.5", className)}>
      {social.map((provider) => {
        const Icon = SOCIAL_PROVIDER_ICON[provider]
        const isPending = pendingProvider === provider
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            className="w-full"
            disabled={pendingProvider !== null}
            onClick={() => void handleClick(provider)}
          >
            <span className="t-icon-swap size-4" data-state={isPending ? "b" : "a"}>
              <Icon className="t-icon size-4" data-icon="a" />
              <Loader2 className="t-icon size-4 animate-spin" data-icon="b" />
            </span>
            {isPending ? "Redirecting…" : SOCIAL_PROVIDER_BUTTON_LABEL[provider]}
          </Button>
        )
      })}
      <Divider />
    </div>
  )
}
