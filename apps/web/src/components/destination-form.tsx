import { zodResolver } from "@hookform/resolvers/zod"
import { Mail, MessageCircle, Send as SendIcon, Webhook } from "lucide-react"
import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useCreateDestination, type DestinationInput } from "@/lib/queries/destinations"

const TYPES = [
  { value: "email", label: "Email", icon: Mail },
  { value: "telegram", label: "Telegram", icon: SendIcon },
  { value: "webhook", label: "Webhook", icon: Webhook },
  { value: "slack", label: "Slack", icon: MessageCircle },
  { value: "discord", label: "Discord", icon: MessageCircle },
] as const
type DestinationType = (typeof TYPES)[number]["value"]

const schemas: Record<DestinationType, z.ZodType> = {
  email: z.object({ name: z.string().optional(), to: z.email("Enter a valid email.") }),
  telegram: z.object({
    name: z.string().optional(),
    bot_token: z.string().min(1, "Required."),
    chat_id: z.string().min(1, "Required."),
  }),
  webhook: z.object({ name: z.string().optional(), url: z.url("Enter a valid URL."), secret: z.string().optional() }),
  slack: z.object({ name: z.string().optional(), url: z.url("Enter a valid URL.") }),
  discord: z.object({ name: z.string().optional(), url: z.url("Enter a valid URL.") }),
}

type FormValues = { name?: string; to?: string; bot_token?: string; chat_id?: string; url?: string; secret?: string }

function toBody(type: DestinationType, values: FormValues): DestinationInput {
  const name = values.name !== undefined && values.name !== "" ? values.name : undefined
  switch (type) {
    case "email":
      return { type, ...(name ? { name } : {}), config: { to: [values.to ?? ""] } }
    case "telegram":
      return { type, ...(name ? { name } : {}), config: { bot_token: values.bot_token ?? "", chat_id: values.chat_id ?? "" } }
    case "webhook":
      return {
        type,
        ...(name ? { name } : {}),
        config: { url: values.url ?? "", ...(values.secret !== undefined && values.secret !== "" ? { secret: values.secret } : {}) },
      }
    case "slack":
      return { type, ...(name ? { name } : {}), config: { url: values.url ?? "" } }
    case "discord":
      return { type, ...(name ? { name } : {}), config: { url: values.url ?? "" } }
  }
}

export function DestinationForm({
  onCreated,
  submitLabel = "Create destination",
}: {
  readonly onCreated: (destination: { readonly id: string; readonly name: string }) => void
  readonly submitLabel?: string
}) {
  const [type, setType] = useState<DestinationType>("email")
  const createDestination = useCreateDestination()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schemas[type] as unknown as Parameters<typeof zodResolver>[0]) as unknown as Resolver<FormValues>,
  })

  const onSubmit = handleSubmit(async (values) => {
    const created = await createDestination.mutateAsync(toBody(type, values))
    toast.success(`${created.name} created.`)
    reset()
    onCreated({ id: created.id, name: created.name })
  })

  return (
    <form
      onSubmit={(e) => {
        void onSubmit(e)
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="grid grid-cols-5 gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              setType(t.value)
              reset()
            }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors duration-(--duration-quick)",
              type === t.value
                ? "border-primary/40 bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dest-name">
          Name <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="dest-name" placeholder={TYPES.find((t) => t.value === type)?.label} {...register("name")} />
      </div>

      {type === "email" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dest-to">Send to</Label>
          <Input id="dest-to" type="email" placeholder="you@example.com" {...register("to")} aria-invalid={errors.to !== undefined} />
          {errors.to && <p className="text-xs text-destructive">{String(errors.to.message)}</p>}
        </div>
      )}

      {type === "telegram" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dest-bot-token">Bot token</Label>
            <Input id="dest-bot-token" placeholder="123456:ABC-DEF…" {...register("bot_token")} aria-invalid={errors.bot_token !== undefined} />
            {errors.bot_token && <p className="text-xs text-destructive">{String(errors.bot_token.message)}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dest-chat-id">Chat id</Label>
            <Input id="dest-chat-id" placeholder="-100123456789" {...register("chat_id")} aria-invalid={errors.chat_id !== undefined} />
            {errors.chat_id && <p className="text-xs text-destructive">{String(errors.chat_id.message)}</p>}
          </div>
        </>
      )}

      {(type === "webhook" || type === "slack" || type === "discord") && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dest-url">{type === "webhook" ? "Endpoint URL" : "Webhook URL"}</Label>
          <Input id="dest-url" placeholder="https://example.com/hook" {...register("url")} aria-invalid={errors.url !== undefined} />
          {errors.url && <p className="text-xs text-destructive">{String(errors.url.message)}</p>}
        </div>
      )}

      {type === "webhook" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dest-secret">
            Signing secret <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="dest-secret" placeholder="Used to sign the X-Postbag-Signature header" {...register("secret")} />
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-1">
        {isSubmitting ? "Creating…" : submitLabel}
      </Button>
    </form>
  )
}
