import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Check, CircleAlert, LogIn, PackageCheck, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"

import { AuthSplitLayout } from "@/components/auth-split-layout"
import { RoutingMark } from "@/components/routing-mark"
import { SocialButtons } from "@/components/social-buttons"
import { SuccessMark } from "@/components/success-mark"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PostbagApiError } from "@/lib/api"
import { useSession } from "@/lib/auth-client"
import { useAnonymousSandbox, useClaimAnonymousSandbox } from "@/lib/queries/anonymous-sandboxes"

const TOKEN_STORAGE_KEY = "postbag-anonymous-claim-token"

export const Route = createFileRoute("/claim")({
  component: ClaimSandboxRoute,
})

function sandboxIdFromToken(token: string): string | null {
  return (
    /^pbs_(fm_[23456789abcdefghjkmnpqrstuvwxyz]{12})\.[A-Za-z0-9_-]{43}$/u.exec(token)?.[1] ?? null
  )
}

function takeClaimToken(): string | null {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/u, ""))
  const fragmentToken = fragment.get("token")
  if (window.location.hash !== "") {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
  }
  if (fragmentToken !== null) {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, fragmentToken)
    return fragmentToken
  }
  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
}

function claimErrorMessage(error: unknown): string {
  if (error instanceof PostbagApiError) {
    if (error.code === "sandbox_expired")
      return "This temporary Form has expired. Ask the agent to create a new one."
    if (error.code === "sandbox_claimed") return "This temporary Form was already claimed."
    if (error.code === "sandbox_claim_email_mismatch") return error.message
    return error.message
  }
  return "Could not load this temporary Form. Check the claim link and try again."
}

function ClaimSandboxRoute() {
  const navigate = useNavigate()
  const { data: session, isPending: sessionPending } = useSession()
  const [token] = useState<string | null>(takeClaimToken)
  const id = token === null ? null : sandboxIdFromToken(token)
  const sandbox = useAnonymousSandbox(id, token)
  const claim = useClaimAnonymousSandbox()

  useEffect(() => {
    if (claim.data === undefined) return
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  }, [claim.data])

  if (token === null || id === null) {
    return (
      <AuthSplitLayout>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <CircleAlert className="size-5" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-semibold text-balance">This claim link is incomplete</h2>
            <p className="text-sm text-muted-foreground text-pretty">
              Open the complete link returned when the temporary Form was created.
            </p>
          </div>
          <Button variant="outline" onClick={() => void navigate({ to: "/" })}>
            Go to Postbag
          </Button>
        </div>
      </AuthSplitLayout>
    )
  }

  if (sandbox.isLoading || sessionPending) {
    return (
      <AuthSplitLayout>
        <div className="flex flex-col gap-4" aria-label="Loading temporary Form">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </AuthSplitLayout>
    )
  }

  if (sandbox.isError || sandbox.data === undefined) {
    return (
      <AuthSplitLayout>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <CircleAlert className="size-5" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-semibold text-balance">
              This temporary Form is unavailable
            </h2>
            <p className="text-sm text-muted-foreground text-pretty">
              {claimErrorMessage(sandbox.error)}
            </p>
          </div>
          <Button variant="outline" onClick={() => void navigate({ to: "/" })}>
            Go to Postbag
          </Button>
        </div>
      </AuthSplitLayout>
    )
  }

  if (claim.data !== undefined) {
    return (
      <AuthSplitLayout>
        <div className="flex flex-col items-center gap-5 text-center">
          <SuccessMark show size={56} />
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-semibold text-balance">The Form is yours</h2>
            <p className="text-sm text-muted-foreground text-pretty">
              {claim.data.copied_test_submissions} test{" "}
              {claim.data.copied_test_submissions === 1 ? "Submission" : "Submissions"} moved with
              it. Add a Destination and Route when you are ready to send new Submissions onward.
            </p>
          </div>
          <Button
            onClick={() =>
              void navigate({ to: "/forms/$formId", params: { formId: claim.data.form.id } })
            }
          >
            Open Form
          </Button>
        </div>
      </AuthSplitLayout>
    )
  }

  const info = sandbox.data

  if (session == null) {
    return (
      <AuthSplitLayout>
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Bring {info.name} home
            </h2>
            <p className="text-sm text-muted-foreground text-pretty">
              Sign in to move this tested Form into your workspace. Its id and submit URL stay the
              same.
            </p>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/60 p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <PackageCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Already wired and tested</p>
                <p className="text-sm text-muted-foreground">
                  {info.accepted_count} of 5 test{" "}
                  {info.accepted_count === 1 ? "Submission" : "Submissions"} stored safely before
                  signup.
                </p>
              </div>
            </div>
          </div>

          <SocialButtons intent="sign-in" callbackURL="/app/claim" />
          <Button
            variant="outline"
            onClick={() => void navigate({ to: "/sign-in", search: { redirect: "/claim" } })}
          >
            <LogIn />
            Sign in with password
          </Button>
        </div>
      </AuthSplitLayout>
    )
  }

  return (
    <AuthSplitLayout>
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-semibold text-balance">
            Bring this Form into your workspace
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Review the handoff, then confirm. Nothing will deliver until you add a Destination and
            Route.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-border/70 bg-muted/60 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <RoutingMark status="sent" size={28} className="mt-0.5 shrink-0" title="Tested Form" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-pretty">{info.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{info.id}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-border/70 pt-4 text-sm">
            <div>
              <p className="text-muted-foreground">Test Submissions</p>
              <p className="font-medium tabular-nums">{info.accepted_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Submit URL</p>
              <p className="flex items-center gap-1 font-medium">
                <Check className="size-3.5 text-success" /> Unchanged
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-pretty">
            This one-time claim token moves the Form only into your active workspace and is
            consumed when the claim succeeds.
          </p>
        </div>

        {claim.isError ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {claimErrorMessage(claim.error)}
          </p>
        ) : null}

        <Button
          disabled={claim.isPending}
          onClick={() => {
            claim.mutate({ id, token })
          }}
        >
          {claim.isPending ? "Claiming Form…" : "Claim Form"}
        </Button>
      </div>
    </AuthSplitLayout>
  )
}
