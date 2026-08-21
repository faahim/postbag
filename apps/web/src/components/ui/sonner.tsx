import type { ComponentProps, CSSProperties } from "react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="bottom-right"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--popover)",
          "--success-text": "var(--success)",
          "--success-border": "var(--border)",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--destructive)",
          "--error-border": "var(--border)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "shadow-lg rounded-lg border font-sans",
        },
        duration: 4000,
      }}
      {...props}
    />
  )
}

export { Toaster }
