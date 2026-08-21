import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute } from "@tanstack/react-router"
import { Mail, RotateCw, Trash2, UserPlus } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { EmptyState } from "@/components/empty-state"
import { SettingsNav } from "@/components/settings-nav"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSession } from "@/lib/auth-client"
import { formatDateTime } from "@/lib/format"
import {
  useCreateInvitation,
  useInvitations,
  useRevokeInvitation,
  type Invitation,
  type InvitationRole,
} from "@/lib/queries/invitations"
import { useMe } from "@/lib/queries/me"
import { useMembers, useRemoveMember, useUpdateMemberRole, type Member, type MemberRole } from "@/lib/queries/members"

export const Route = createFileRoute("/_app/settings/members")({
  component: MembersRoute,
})

const ROLE_LABEL: Record<MemberRole, string> = { owner: "Owner", admin: "Admin", member: "Member" }

function initials(name: string, email: string): string {
  const source = name.trim().length > 0 ? name : email
  const parts = source.trim().split(/\s+/u)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase() || "?"
}

function MembersRoute() {
  const me = useMe()
  const { data: session } = useSession()
  const members = useMembers()
  const invitations = useInvitations()

  const activeOrg = me.data?.organizations.find((org) => org.is_active)
  const callerRole = activeOrg?.role ?? null
  const isOwner = callerRole === "owner"
  const canManage = callerRole === "owner" || callerRole === "admin"
  const callerUserId = session?.user.id

  const loading = members.isLoading || invitations.isLoading
  const alone = (members.data?.length ?? 0) <= 1 && (invitations.data?.length ?? 0) === 0

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Who has access to this workspace, and what they can do.</p>
      </div>

      <SettingsNav />

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : alone ? (
        <EmptyState
          title="It's just you here"
          description="Invite teammates, clients, or an agency partner below — they'll get their own role and can be removed any time."
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-0 p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.data?.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isOwner={isOwner}
                    canManage={canManage}
                    isSelf={member.user.id === callerUserId}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!loading && (invitations.data?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Pending invitations</h2>
          <Card>
            <CardContent className="flex flex-col gap-0 p-0">
              <Table>
                <TableBody>
                  {invitations.data?.map((invitation) => (
                    <InvitationRow key={invitation.id} invitation={invitation} canManage={canManage} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {canManage && <InviteCard />}
    </div>
  )
}

function MemberRow({
  member,
  isOwner,
  canManage,
  isSelf,
}: {
  readonly member: Member
  readonly isOwner: boolean
  readonly canManage: boolean
  readonly isSelf: boolean
}) {
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()

  function changeRole(role: MemberRole) {
    if (role === member.role) return
    updateRole.mutate(
      { memberId: member.id, role },
      {
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Couldn't change that member's role.")
        },
      },
    )
  }

  function remove() {
    removeMember.mutate(member.id, {
      onSuccess: () => {
        toast.success(isSelf ? "You left the workspace." : `${member.user.name || member.user.email} was removed.`)
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Couldn't remove that member.")
      },
    })
  }

  const canRemove = isSelf || canManage

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8">
            <AvatarFallback>{initials(member.user.name, member.user.email)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{member.user.name || member.user.email}</span>
            <span className="truncate text-xs text-muted-foreground">{member.user.email}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {isOwner ? (
          <Select value={member.role} onValueChange={(value) => { changeRole(value as MemberRole) }} disabled={updateRole.isPending}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline">{ROLE_LABEL[member.role]}</Badge>
        )}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{formatDateTime(member.joined_at)}</TableCell>
      <TableCell className="text-right">
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={isSelf ? "Leave workspace" : "Remove member"}
            onClick={remove}
            disabled={removeMember.isPending}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

function InvitationRow({ invitation, canManage }: { readonly invitation: Invitation; readonly canManage: boolean }) {
  const createInvitation = useCreateInvitation()
  const revokeInvitation = useRevokeInvitation()

  function resend() {
    createInvitation.mutate(
      { email: invitation.email, role: invitation.role === "owner" ? "admin" : invitation.role },
      {
        onSuccess: () => {
          toast.success(`Invitation resent to ${invitation.email}.`)
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Couldn't resend that invitation.")
        },
      },
    )
  }

  function revoke() {
    revokeInvitation.mutate(invitation.id, {
      onSuccess: () => {
        toast.success("Invitation revoked.")
      },
      onError: () => {
        toast.error("Couldn't revoke that invitation.")
      },
    })
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Mail className="size-3.5" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{invitation.email}</span>
            <span className="text-xs text-muted-foreground">
              Expires {formatDateTime(invitation.expires_at)}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{ROLE_LABEL[invitation.role]}</Badge>
      </TableCell>
      <TableCell className="text-right">
        {canManage && (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" aria-label="Resend invitation" onClick={resend} disabled={createInvitation.isPending}>
              <RotateCw className="size-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Revoke invitation" onClick={revoke} disabled={revokeInvitation.isPending}>
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

const inviteSchema = z.object({
  email: z.email("Enter a valid email."),
  role: z.enum(["admin", "member"]),
})
type InviteValues = z.infer<typeof inviteSchema>

function InviteCard() {
  const createInvitation = useCreateInvitation()
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { role: "member" } })
  const role = watch("role")

  const onSubmit = handleSubmit(async (values: InviteValues) => {
    try {
      await createInvitation.mutateAsync(values)
      toast.success(`Invited ${values.email}.`)
      reset({ email: "", role: "member" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send that invitation.")
    }
  })

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <UserPlus className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Invite someone</h2>
        </div>
        <form
          onSubmit={(e) => {
            void onSubmit(e)
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          noValidate
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@example.com"
              {...register("email")}
              aria-invalid={errors.email !== undefined}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => { setValue("role", value as InvitationRole) }}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isSubmitting} className="sm:self-end">
            {isSubmitting ? "Sending…" : "Send invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
