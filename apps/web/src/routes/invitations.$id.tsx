import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { AuthSplitLayout } from "@/components/auth-split-layout"
import { RoutingMark } from "@/components/routing-mark"
import { SocialButtons } from "@/components/social-buttons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PostbagApiError } from "@/lib/api"
import { signOut, useSession } from "@/lib/auth-client"
import { useAcceptInvitation, usePublicInvitation } from "@/lib/queries/invitations"

export const Route = createFileRoute("/invitations/$id")({
  component: AcceptInvitationRoute,
})

function invitationErrorMessage(error: unknown): string {
  if (error instanceof PostbagApiError) {
    if (error.code === "invitation_expired") return "This invitation has expired. Ask whoever invited you to send a new one."
    if (error.code === "invitation_already_used") return "This invitation was already accepted or revoked."
    if (error.code === "not_found") return "This invitation doesn't exist — check the link."
    return error.message
  }
  return "Couldn't load this invitation."
}

function AcceptInvitationRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: session, isPending: sessionPending } = useSession()
  const invitation = usePublicInvitation(id)
  const acceptInvitation = useAcceptInvitation()

  const [outcome, setOutcome] = useState<"accepted" | "mismatch" | null>(null)
  const [organizationName, setOrganizationName] = useState<string | null>(null)

  const redirectTarget = `/invitations/${id}`
  const invitationEmail = session?.user.email

  // Auto-accepts the instant a session exists — whether the visitor was already signed in,
  // or just arrived back here after signing in/up via `redirect`. Job L §3: a fresh
  // sign-up from this page still joins the inviting org for that first session.
  useEffect(() => {
    if (sessionPending || session == null) return
    if (invitation.data === undefined || invitation.isError) return
    if (outcome !== null || acceptInvitation.isPending) return
    acceptInvitation.mutate(id, {
      onSuccess: (result) => {
        setOrganizationName(result.organization.name)
        setOutcome("accepted")
      },
      onError: (error) => {
        if (error instanceof PostbagApiError && error.code === "invitation_email_mismatch") {
          setOutcome("mismatch")
          return
        }
        toast.error(invitationErrorMessage(error))
      },
    })
  }, [sessionPending, session, invitation.data, invitation.isError, id])

  useEffect(() => {
    if (outcome !== "accepted") return
    const timer = setTimeout(() => {
      void navigate({ to: "/" })
    }, 1800)
    return () => {
      clearTimeout(timer)
    }
  }, [outcome, navigate])

  if (sessionPending || invitation.isLoading) {
    return (
      <AuthSplitLayout>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </AuthSplitLayout>
    )
  }

  if (invitation.isError || invitation.data === undefined) {
    return (
      <AuthSplitLayout>
        <div className="flex flex-col items-center gap-4 text-center">
          <RoutingMark status="failed" size={40} />
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-semibold text-balance">This invitation isn't available</h2>
            <p className="text-sm text-muted-foreground">{invitationErrorMessage(invitation.error)}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void navigate({ to: "/" })
            }}
          >
            Go to Postbag
          </Button>
        </div>
      </AuthSplitLayout>
    )
  }

  const info = invitation.data

  if (outcome === "accepted") {
    return (
      <AuthSplitLayout>
        <div className="flex flex-col items-center gap-4 text-center">
          <RoutingMark status="sent" size={48} />
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-semibold text-balance">You're in</h2>
            <p className="text-sm text-muted-foreground">
              You joined <span className="font-medium text-foreground">{organizationName ?? info.organization.name}</span>.
              Taking you to your dashboard…
            </p>
          </div>
        </div>
      </AuthSplitLayout>
    )
  }

  if (outcome === "mismatch") {
    return (
      <AuthSplitLayout>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-semibold text-balance">Wrong email address</h2>
            <p className="text-sm text-muted-foreground">
              This invitation was sent to <span className="font-medium text-foreground">{info.email_hint}</span>, but
              you're signed in as <span className="font-medium text-foreground">{invitationEmail}</span>.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void signOut().then(() => navigate({ to: "/sign-in", search: { redirect: redirectTarget } }))
            }}
          >
            Sign out and try a different account
          </Button>
        </div>
      </AuthSplitLayout>
    )
  }

  // Signed in, waiting for the accept effect above to resolve — a beat, not a real wait.
  if (session != null) {
    return (
      <AuthSplitLayout>
        <div className="flex flex-col items-center gap-4 text-center">
          <RoutingMark status="pending" size={40} className="animate-pulse" />
          <p className="text-sm text-muted-foreground">Joining {info.organization.name}…</p>
        </div>
      </AuthSplitLayout>
    )
  }

  return (
    <AuthSplitLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-semibold text-balance">You've been invited</h2>
          <p className="text-sm text-muted-foreground">
            {info.invited_by_name ?? "Someone"} invited <span className="font-medium text-foreground">{info.email_hint}</span> to
            join <span className="font-medium text-foreground">{info.organization.name}</span> on Postbag as {info.role}.
          </p>
        </div>

        <SocialButtons intent="sign-in" callbackURL={redirectTarget} />

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              void navigate({ to: "/sign-in", search: { redirect: redirectTarget } })
            }}
          >
            Sign in to accept
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void navigate({ to: "/sign-up", search: { redirect: redirectTarget } })
            }}
          >
            Create an account
          </Button>
        </div>
      </div>
    </AuthSplitLayout>
  )
}
