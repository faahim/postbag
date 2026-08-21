import { zodResolver } from "@hookform/resolvers/zod"
import { Mail, MessageCircle, Send as SendIcon, Webhook } from "lucide-react"
import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toastApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useCreateDestination, useUpdateDestination, type Destination, type DestinationInput } from "@/lib/queries/destinations"

export const DESTINATION_TYPES = [
  { value: "email", label: "Email", icon: Mail },
  { value: "telegram", label: "Telegram", icon: SendIcon },
  { value: "webhook", label: "Webhook", icon: Webhook },
  { value: "slack", label: "Slack", icon: MessageCircle },
  { value: "discord", label: "Discord", icon: MessageCircle },
] as const
export type DestinationType = (typeof DESTINATION_TYPES)[number]["value"]

/** "a@x.com, b@y.com" → ["a@x.com", "b@y.com"] */
function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,\s]+/u)
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

const emailList = (message: string) =>
  z.string().refine((value) => splitList(value).every((v) => z.email().safeParse(v).success), message)

function schemaFor(type: DestinationType, mode: "create" | "edit"): z.ZodType {
  const name = z.string().optional()
  // Secrets are required when creating and optional when editing (blank = keep the current one).
  const secretField = mode === "create" ? z.string().min(1, "Required.") : z.string().optional()
  switch (type) {
    case "email":
      return z.object({
        name,
        to: emailList("Enter one or more valid email addresses, separated by commas.").refine((v) => splitList(v).length > 0, "Enter at least one address."),
        cc: emailList("Enter valid email addresses, separated by commas.").optional(),
        subject_template: z.string().optional(),
      })
    case "telegram":
      return z.object({ name, bot_token: secretField, chat_id: z.string().min(1, "Required.") })
    case "webhook":
      return z.object({ name, url: z.url("Enter a valid URL."), secret: z.string().optional() })
    case "slack":
    case "discord":
      return z.object({ name, url: z.url("Enter a valid URL.") })
  }
}

type FormValues = {
  name?: string
  to?: string
  cc?: string
  subject_template?: string
  bot_token?: string
  chat_id?: string
  url?: string
  secret?: string
}

function configFor(type: DestinationType, values: FormValues, mode: "create" | "edit"): Record<string, unknown> {
  switch (type) {
    case "email": {
      const config: Record<string, unknown> = { to: splitList(values.to), cc: splitList(values.cc) }
      const subject = values.subject_template?.trim() ?? ""
      if (subject.length > 0 || mode === "edit") config["subject_template"] = subject.length > 0 ? subject : "New submission: {{form.name}}"
      return config
    }
    case "telegram": {
      const config: Record<string, unknown> = { chat_id: values.chat_id ?? "" }
      if ((values.bot_token ?? "").length > 0) config["bot_token"] = values.bot_token
      return config
    }
    case "webhook": {
      const config: Record<string, unknown> = { url: values.url ?? "" }
      if ((values.secret ?? "").length > 0) config["secret"] = values.secret
      return config
    }
    case "slack":
    case "discord":
      return { url: values.url ?? "" }
  }
}

function initialValues(destination: Destination | undefined): FormValues {
  if (destination === undefined) return {}
  const config = destination.config as Record<string, unknown>
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").join(", ") : "")
  const str = (value: unknown) => (typeof value === "string" ? value : "")
  return {
    name: destination.name,
    to: list(config["to"]),
    cc: list(config["cc"]),
    subject_template: str(config["subject_template"]),
    chat_id: str(config["chat_id"]),
    url: str(config["url"]),
    // secrets come back redacted — start blank, blank means "keep"
    bot_token: "",
    secret: "",
  }
}

/**
 * Create a destination, or edit an existing one (`destination` set). Editing keeps the type
 * fixed — a destination *is* its type; make a new one to send somewhere else — and treats
 * blank secret fields as "keep what's there", since the API never returns secrets.
 */
export function DestinationForm({
  destination,
  onSaved,
  submitLabel,
}: {
  readonly destination?: Destination
  readonly onSaved: (destination: { readonly id: string; readonly name: string }) => void
  readonly submitLabel?: string
}) {
  const mode = destination === undefined ? "create" : "edit"
  const [type, setType] = useState<DestinationType>(destination?.type ?? "email")
  const createDestination = useCreateDestination()
  const updateDestination = useUpdateDestination()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schemaFor(type, mode) as unknown as Parameters<typeof zodResolver>[0]) as unknown as Resolver<FormValues>,
    defaultValues: initialValues(destination),
  })

  const onSubmit = handleSubmit(async (values) => {
    const name = values.name?.trim() ?? ""
    try {
      if (destination === undefined) {
        const body = { type, ...(name.length > 0 ? { name } : {}), config: configFor(type, values, "create") } as DestinationInput
        const created = await createDestination.mutateAsync(body)
        toast.success(`${created.name} created.`)
        reset()
        onSaved({ id: created.id, name: created.name })
      } else {
        const updated = await updateDestination.mutateAsync({
          destinationId: destination.id,
          body: { ...(name.length > 0 ? { name } : {}), config: configFor(type, values, "edit") },
        })
        toast.success(`${updated.name} saved.`)
        onSaved({ id: updated.id, name: updated.name })
      }
    } catch (error) {
      toastApiError(error, mode === "create" ? "Couldn't create the destination — try again." : "Couldn't save the destination — try again.")
    }
  })

  const typeMeta = DESTINATION_TYPES.find((t) => t.value === type)

  return (
    <form
      onSubmit={(e) => {
        void onSubmit(e)
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      {mode === "create" ? (
        <div className="grid grid-cols-5 gap-1.5">
          {DESTINATION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setType(t.value)
                reset()
              }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors duration-(--duration-quick)",
                type === t.value ? "border-primary/40 bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        typeMeta !== undefined && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <typeMeta.icon className="size-4" />
            <span>
              {typeMeta.label} · <span className="font-mono text-xs">{destination?.id}</span>
            </span>
          </div>
        )
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dest-name">
          Name <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="dest-name" placeholder={type === "email" ? "Sales inbox" : (typeMeta?.label ?? "")} {...register("name")} />
        {mode === "create" && <p className="text-xs text-muted-foreground">Left blank, it's named after where it sends — the address, chat or host.</p>}
      </div>

      {type === "email" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dest-to">Send to</Label>
            <Input id="dest-to" placeholder="you@example.com, sales@example.com" {...register("to")} aria-invalid={errors.to !== undefined} />
            {errors.to ? (
              <p className="text-xs text-destructive">{String(errors.to.message)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">One or more addresses, separated by commas.</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dest-cc">
              Cc <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="dest-cc" placeholder="manager@example.com" {...register("cc")} aria-invalid={errors.cc !== undefined} />
            {errors.cc && <p className="text-xs text-destructive">{String(errors.cc.message)}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dest-subject">
              Subject <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="dest-subject" placeholder="New submission: {{form.name}}" {...register("subject_template")} />
            <p className="text-xs text-muted-foreground">
              Can use <span className="font-mono">{"{{form.name}}"}</span> and any submitted field, e.g. <span className="font-mono">{"{{data.email}}"}</span>.
            </p>
          </div>
        </>
      )}

      {type === "telegram" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dest-bot-token">
              Bot token {mode === "edit" && <span className="font-normal text-muted-foreground">(leave blank to keep the current one)</span>}
            </Label>
            <Input id="dest-bot-token" placeholder={mode === "edit" ? "••••••••" : "123456:ABC-DEF…"} {...register("bot_token")} aria-invalid={errors.bot_token !== undefined} />
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
            Signing secret{" "}
            <span className="font-normal text-muted-foreground">{mode === "edit" ? "(leave blank to keep the current one)" : "(optional)"}</span>
          </Label>
          <Input id="dest-secret" placeholder={mode === "edit" ? "••••••••" : "Used to sign the X-Postbag-Signature header"} {...register("secret")} />
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-1">
        {isSubmitting ? (mode === "create" ? "Creating…" : "Saving…") : (submitLabel ?? (mode === "create" ? "Create destination" : "Save changes"))}
      </Button>
    </form>
  )
}
