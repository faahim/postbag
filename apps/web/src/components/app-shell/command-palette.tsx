import { useNavigate } from "@tanstack/react-router"
import { Building2, FilePlus2, Plus, Send } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { NAV_ITEMS } from "@/lib/nav"
import { useMe } from "@/lib/queries/me"
import { useSetActiveOrganization } from "@/lib/queries/organizations"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const me = useMe()
  const setActive = useSetActiveOrganization()
  const otherOrganizations = (me.data?.organizations ?? []).filter((org) => !org.is_active)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  function close() {
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to, or create…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Create">
          <CommandItem
            onSelect={() => {
              close()
              void navigate({ to: "/forms", search: { new: true } })
            }}
          >
            <FilePlus2 />
            New form
          </CommandItem>
          <CommandItem
            onSelect={() => {
              close()
              void navigate({ to: "/destinations", search: { new: true } })
            }}
          >
            <Plus />
            New destination
          </CommandItem>
          <CommandItem
            onSelect={() => {
              close()
              void navigate({ to: "/forms", search: { new: true } })
            }}
          >
            <Send />
            Quickstart (form + email in one call)
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.to}
              onSelect={() => {
                close()
                void navigate({ to: item.to })
              }}
            >
              <item.icon />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {otherOrganizations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch to">
              {otherOrganizations.map((org) => (
                <CommandItem
                  key={org.id}
                  onSelect={() => {
                    close()
                    setActive.mutate(org.id, {
                      onError: () => {
                        toast.error("Couldn't switch workspace — try again.")
                      },
                    })
                  }}
                >
                  <Building2 />
                  {org.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
