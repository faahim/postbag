import { useNavigate } from "@tanstack/react-router"
import { Check, ChevronsUpDown, Plus, Settings, Users } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateOrganizationDialog } from "@/components/app-shell/create-organization-dialog"
import { VipBadge } from "@/components/vip-badge"
import { useMe } from "@/lib/queries/me"
import { useSetActiveOrganization } from "@/lib/queries/organizations"

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member" }

export function OrgSwitcher() {
  const navigate = useNavigate()
  const me = useMe()
  const setActive = useSetActiveOrganization()
  const [createOpen, setCreateOpen] = useState(false)

  const organizations = me.data?.organizations ?? []
  const activeName =
    organizations.find((org) => org.is_active)?.name ?? me.data?.organization.name ?? "Workspace"

  async function switchTo(organizationId: string) {
    if (setActive.isPending) return
    try {
      await setActive.mutateAsync(organizationId)
    } catch {
      toast.error("Couldn't switch workspace — try again.")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="max-w-36 shrink gap-1.5 text-muted-foreground sm:max-w-64"
          >
            <span className="min-w-0 flex-1 truncate text-left">{activeName}</span>
            <ChevronsUpDown className="size-3.5 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onSelect={() => {
                if (!org.is_active) void switchTo(org.id)
              }}
              className="gap-2"
            >
              <Check className={org.is_active ? "size-3.5 opacity-100" : "size-3.5 opacity-0"} />
              <span className="flex-1 truncate">{org.name}</span>
              {org.role !== null && (
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABEL[org.role] ?? org.role}
                </span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setCreateOpen(true)
            }}
          >
            <Plus />
            Create organization
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              void navigate({ to: "/settings" })
            }}
          >
            <Settings />
            Workspace settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void navigate({ to: "/settings/members" })
            }}
          >
            <Users />
            Members
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {me.data?.organization.plan_source === "complimentary" && <VipBadge />}

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
