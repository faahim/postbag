import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { ConnectedAccountsCard } from "@/components/connected-accounts-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsRoute,
})

function SettingsRoute() {
  const queryClient = useQueryClient()
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.GET("/v1/me")
      return data
    },
  })
  const [name, setName] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  const currentName = name ?? me.data?.organization.name ?? ""

  async function save() {
    if (me.data === undefined) return
    setSaving(true)
    try {
      await authClient.organization.update({ organizationId: me.data.organization.id, data: { name: currentName } })
      await queryClient.invalidateQueries({ queryKey: ["me"] })
      toast.success("Workspace updated.")
    } catch {
      toast.error("Couldn't save — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace name, plan and timezone.</p>
      </div>

      {me.isLoading || me.data === undefined ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-name">Workspace name</Label>
              <Input
                id="org-name"
                value={currentName}
                onChange={(e) => {
                  setName(e.target.value)
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Plan</Label>
              <p className="text-sm text-muted-foreground capitalize">{me.data.organization.plan}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Timezone</Label>
              <p className="text-sm text-muted-foreground">{me.data.organization.timezone}</p>
            </div>
            <Button className="self-start" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </CardContent>
        </Card>
      )}

      <ConnectedAccountsCard />
    </div>
  )
}
