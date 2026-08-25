import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command palette",
  description = "Search Forms, Streams, Destinations and actions",
  children,
  ...props
}: ComponentProps<typeof Dialog> & {
  readonly title?: string
  readonly description?: string
  readonly children: ReactNode
}) {
  return (
    <Dialog {...props}>
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <DialogDescription className="sr-only">{description}</DialogDescription>
      <DialogContent
        className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 shadow-xl sm:max-w-xl"
        showCloseButton={false}
      >
        <Command className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:size-4 [&_[cmdk-input]]:h-13 [&_[cmdk-item]]:gap-2.5 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:size-4">
          {children}
        </Command>
        <div className="flex items-center gap-4 border-t border-border/60 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">↵</kbd> open
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">esc</kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex items-center gap-2 border-b border-border/70 px-3">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-13 w-full rounded-md bg-transparent py-3 text-[15px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("max-h-96 scroll-py-2 overflow-x-hidden overflow-y-auto py-1", className)}
      {...props}
    />
  )
}

function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className="py-6 text-center text-sm text-muted-foreground" {...props} />
}

function CommandGroup({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn("overflow-hidden py-1 text-foreground", className)}
      {...props}
    />
  )
}

function CommandSeparator({ className, ...props }: ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator data-slot="command-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  )
}

function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none",
        "transition-colors duration-(--duration-quick)",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

function CommandShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
}
