import { useNavigate } from "@tanstack/react-router"
import { FilePlus2, Plus, Send } from "lucide-react"
import { useEffect, useState } from "react"

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

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

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
      </CommandList>
    </CommandDialog>
  )
}
