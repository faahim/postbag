import { createFileRoute } from "@tanstack/react-router"
import { Check, ChevronsUpDown } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConnectedAccountsCard } from "@/components/connected-accounts-card"
import { PlanCard } from "@/components/plan-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { api, unwrap } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { billingIntentFromSearch, billingIntentSearchSchema } from "@/lib/billing-intent"
import { useMe } from "@/lib/queries/me"
import { timeZoneOptions } from "@/lib/timezones"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsRoute,
  validateSearch: billingIntentSearchSchema,
})

/** Searchable IANA timezone picker — the default clock for new digest Routes. */
function TimezoneField({
  value,
  onChange,
}: {
  readonly value: string
  readonly onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const zones = useMemo(() => timeZoneOptions(Intl.supportedValuesOf("timeZone"), value), [value])

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
    const organizationId = me.data.organization.id
    setSaving(true)
    const nameChanged = currentName !== savedName
    const timezoneChanged = currentTimezone !== savedTimezone

    const [nameResult, timezoneResult] = await Promise.allSettled([
      nameChanged
        ? (async () => {
            const result = await authClient.organization.update({
              organizationId,
              data: { name: currentName },
            })
            if (result.error !== null) throw new Error(result.error.message ?? "Couldn't update the workspace name.")
          })()
        : Promise.resolve(),
      timezoneChanged
        ? (async () => {
            unwrap(await api.PATCH("/v1/organizations/active", { body: { timezone: currentTimezone } }))
          })()
        : Promise.resolve(),
    ])

    const nameSaved = nameResult.status === "fulfilled"
    const timezoneSaved = timezoneResult.status === "fulfilled"
    const successfulChanges = Number(nameChanged && nameSaved) + Number(timezoneChanged && timezoneSaved)
    const failedChanges = Number(nameChanged && !nameSaved) + Number(timezoneChanged && !timezoneSaved)
    const refreshed = await me.refetch()

    if (refreshed.isSuccess) {
      if (nameSaved) setName(undefined)
      if (timezoneSaved) setTimezone(undefined)
    }

    if (failedChanges === 0) {
      if (refreshed.isSuccess) {
        toast.success("Workspace updated.")
      } else {
        toast.warning("Workspace updated, but this view couldn't refresh.", {
          description: "Reload to see the saved values.",
        })
      }
    } else if (successfulChanges > 0) {
      toast.warning("Workspace partly updated.", {
        description: nameChanged && nameSaved
          ? "The name was saved, but the timezone was not. Try the timezone again."
          : "The timezone was saved, but the name was not. Try the name again.",
      })
    } else {
      toast.error(
        nameChanged && timezoneChanged
          ? "Couldn't save either change — try again."
          : nameChanged
            ? "Couldn't save the workspace name — try again."
            : "Couldn't save the timezone — try again.",
      )
    }

    setSaving(false)
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
            <CardDescription>
              The name everyone sees, and the default clock for new digest Routes.
            </CardDescription>
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
              <p className="text-xs text-muted-foreground">
                New digest Routes start on this clock. Existing Routes keep their own timezone.
              </p>
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
