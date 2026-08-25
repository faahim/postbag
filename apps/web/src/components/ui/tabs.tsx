import * as TabsPrimitive from "@radix-ui/react-tabs"
import { useEffect, useRef, type ComponentProps } from "react"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-5", className)} {...props} />
}

/** transitions-dev tabs-sliding: one pill travels between triggers instead of
 * each trigger painting its own background. First paint places it without a
 * transition so it never animates in from x=0/width=0. */
function TabsList({ className, children, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const firstPaint = useRef(true)

  useEffect(() => {
    const list = listRef.current
    const pill = pillRef.current
    if (list === null || pill === null) return

    const position = () => {
      const active = list.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-state="active"]')
      if (active === null) {
        pill.style.opacity = "0"
        return
      }
      pill.style.opacity = "1"
      const move = () => {
        pill.style.transform = `translateX(${active.offsetLeft.toString()}px)`
        pill.style.width = `${active.offsetWidth.toString()}px`
      }
      if (firstPaint.current) {
        firstPaint.current = false
        pill.style.transition = "none"
        move()
        void pill.offsetWidth
        pill.style.transition = ""
      } else {
        move()
      }
    }

    position()
    const mutations = new MutationObserver(position)
    mutations.observe(list, { subtree: true, attributeFilter: ["data-state"] })
    const resizes = new ResizeObserver(position)
    resizes.observe(list)
    return () => {
      mutations.disconnect()
      resizes.disconnect()
    }
  }, [])

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      className={cn(
        "relative inline-flex h-10 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span
        ref={pillRef}
        aria-hidden="true"
        className="absolute inset-y-1 left-0 rounded-md bg-card shadow-sm transition-[transform,width] duration-(--tabs-dur) ease-(--tabs-ease)"
      />
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center gap-1.5 rounded-md px-3.5 py-1 text-sm font-medium whitespace-nowrap",
        "text-muted-foreground outline-none",
        "transition-[color] duration-(--tabs-dur) ease-(--tabs-ease)",
        "focus-visible:ring-[3px] focus-visible:ring-ring",
        "data-[state=active]:text-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 outline-none",
        "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-(--duration-fast)",
        className,
      )}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
