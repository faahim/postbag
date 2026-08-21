import { Loader2 } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatRelativeTime } from "@/lib/format"
import { useAuthProviders } from "@/lib/queries/auth-providers"
import { useLinkedAccounts, useLinkSocial, useUnlinkAccount } from "@/lib/queries/linked-accounts"
import { SOCIAL_PROVIDER_ICON, SOCIAL_PROVIDER_NAME } from "@/lib/social-provider-meta"

/** Job G 2b — one row per social provider this instance has configured: connected (with
 * a "Disconnect") or not (with a "Connect"). Disconnect is disabled, with a tooltip
 * explaining why, when it is the account's only way to sign in (no password, no other
 * linked provider) — never let a user lock themselves out from this screen. */
export function ConnectedAccountsCard() {
  const authProviders = useAuthProviders()
  const linkedAccounts = useLinkedAccounts()
  const linkSocial = useLinkSocial()
  const unlinkAccount = useUnlinkAccount()

  const isLoading = authProviders.isLoading || linkedAccounts.isLoading
  const social = authProviders.data?.social ?? []
  const accounts = linkedAccounts.data ?? []
  const hasPassword = accounts.some((account) => account.providerId === "credential")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>Sign in with Google or GitHub, or keep them alongside your password.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : social.length === 0 ? (
          <EmptyState
            status="pending"
            title="No social sign-in on this instance"
            description="This Postbag hasn't configured Google or GitHub — sign in with your email and password."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {social.map((provider) => {
              const Icon = SOCIAL_PROVIDER_ICON[provider]
              const linked = accounts.find((account) => account.providerId === provider)
              const isOnlySignInMethod = linked !== undefined && !hasPassword && accounts.length <= 1
              const isConnecting = linkSocial.isPending && linkSocial.variables === provider
              const isDisconnecting = unlinkAccount.isPending && unlinkAccount.variables === provider

              return (
                <li key={provider} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-medium text-foreground">{SOCIAL_PROVIDER_NAME[provider]}</p>
                      <p className="text-xs text-muted-foreground">
                        {linked === undefined ? "Not connected" : `Connected ${formatRelativeTime(linked.createdAt)}`}
                      </p>
                    </div>
                  </div>

                  {linked === undefined ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isConnecting}
                      onClick={() => {
                        linkSocial.mutate(provider)
                      }}
                    >
                      {isConnecting && <Loader2 className="size-3.5 animate-spin" />}
                      Connect
                    </Button>
                  ) : isOnlySignInMethod ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* A disabled button swallows pointer events, so the tooltip needs a
                            hoverable wrapper around it to still open. */}
                        <span tabIndex={0}>
                          <Button type="button" variant="outline" size="sm" disabled className="pointer-events-none">
                            Disconnect
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Set a password first, or connect another provider — this is your only way to sign in.</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isDisconnecting}
                      onClick={() => {
                        unlinkAccount.mutate(linked.providerId)
                      }}
                    >
                      {isDisconnecting && <Loader2 className="size-3.5 animate-spin" />}
                      Disconnect
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
