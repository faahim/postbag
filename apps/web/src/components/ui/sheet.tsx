import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function Sheet(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal(props: ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-(--panel-open-dur)",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--panel-close-dur)",
        className,
      )}
      {...props}
    />
  )
}

const sheetVariants = cva(
  "fixed z-50 flex flex-col gap-4 border-border/70 bg-card shadow-xl transition ease-(--panel-ease)",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-full border-l sm:max-w-md " +
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-(--panel-open-dur) " +
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=closed]:duration-(--panel-close-dur)",
        left:
          "inset-y-0 left-0 h-full w-full border-r sm:max-w-md " +
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=open]:duration-(--panel-open-dur) " +
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=closed]:duration-(--panel-close-dur)",
        top: "inset-x-0 top-0 h-auto border-b data-[state=open]:animate-in data-[state=open]:slide-in-from-top data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top",
        bottom:
          "inset-x-0 bottom-0 h-auto border-t data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
)

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & VariantProps<typeof sheetVariants>) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content data-slot="sheet-content" className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        <DialogPrimitive.Close
          className={cn(
            "absolute top-4 right-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none",
            "transition-[background-color,color] duration-(--duration-quick) hover:bg-muted hover:text-foreground",
            "focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none",
          )}
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 border-b border-border/60 px-6 pt-6 pb-5", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 px-6 pb-6", className)} {...props} />
}

function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("pr-8 text-lg leading-snug font-semibold tracking-tight text-balance text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger }
