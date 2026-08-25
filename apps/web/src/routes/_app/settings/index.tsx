import { createFileRoute } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Check, ChevronsUpDown } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConnectedAccountsCard } from "@/components/connected-accounts-card"
import { PlanCard } from "@/components/plan-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { api, unwrap } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { billingIntentFromSearch, billingIntentSearchSchema } from "@/lib/billing-intent"
import { useMe } from "@/lib/queries/me"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsRoute,
  validateSearch: billingIntentSearchSchema,
})

/** Searchable IANA timezone picker — the org's clock for digests. */
function TimezoneField({ value, onChange }: { readonly value: string; readonly onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false)
  const zones = useMemo(() => Intl.supportedValuesOf("timeZone"), [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value.replaceAll("_", " ")}
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezones…" className="h-10 text-sm" />
          <CommandList className="max-h-64">
            <CommandEmpty>No timezone matches that.</CommandEmpty>
            <CommandGroup>
              {zones.map((zone) => (
                <CommandItem
                  key={zone}
                  value={zone}
                  onSelect={() => {
                    onChange(zone)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("size-4", zone === value ? "opacity-100" : "opacity-0")} />
                  {zone.replaceAll("_", " ")}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function SettingsRoute() {
  const search = Route.useSearch()
  const queryClient = useQueryClient()
  const me = useMe()
  const [name, setName] = useState<string | undefined>(undefined)
  const [timezone, setTimezone] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  const savedName = me.data?.organization.name ?? ""
  const savedTimezone = me.data?.organization.timezone ?? "UTC"
  const currentName = name ?? savedName
  const currentTimezone = timezone ?? savedTimezone
  const dirty = currentName !== savedName || currentTimezone !== savedTimezone

  async function save() {
    if (me.data === undefined) return
    setSaving(true)
    try {
      if (currentName !== savedName) {
        await authClient.organization.update({ organizationId: me.data.organization.id, data: { name: currentName } })
      }
      if (currentTimezone !== savedTimezone) {
        unwrap(await api.PATCH("/v1/organizations/active", { body: { timezone: currentTimezone } }))
      }
      await queryClient.invalidateQueries({ queryKey: ["me"] })
      setName(undefined)
      setTimezone(undefined)
      toast.success("Workspace updated.")
    } catch {
      toast.error("Couldn't save — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PlanCard checkoutIntent={billingIntentFromSearch(search)} />

      {me.isLoading || me.data === undefined ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg tracking-tight">Workspace</CardTitle>
            <CardDescription>The name everyone sees, and the clock your digest Routes follow.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={currentName}
                onChange={(e) => {
                  setName(e.target.value)
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Timezone</Label>
              <TimezoneField value={currentTimezone} onChange={setTimezone} />
              <p className="text-xs text-muted-foreground">Daily and weekly digests land by this clock.</p>
            </div>
            <Button className="self-start" onClick={() => void save()} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </CardContent>
        </Card>
      )}

      <ConnectedAccountsCard />
    </div>
  )
}
