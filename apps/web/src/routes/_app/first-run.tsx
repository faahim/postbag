import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute } from "@tanstack/react-router"
import { ArrowRight, Terminal } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { CopyButton } from "@/components/copy-button"
import { EmbedSnippetTabs } from "@/components/embed-snippets"
import { Postmark } from "@/components/postmark"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDateTime } from "@/lib/format"
import { useQuickstart } from "@/lib/queries/forms"
import { useFormSubmissions } from "@/lib/queries/submissions"

const quickstartFormSchema = z.object({
  name: z.string().min(1, "Name your form."),
  notify_email: z.email("Enter a valid email address."),
  origin: z.union([z.url(), z.literal("")]).optional(),
})
type QuickstartFormValues = z.infer<typeof quickstartFormSchema>

export const Route = createFileRoute("/_app/first-run")({
  component: FirstRunRoute,
})

function FirstRunRoute() {
  const quickstart = useQuickstart()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<QuickstartFormValues>({ resolver: zodResolver(quickstartFormSchema) })

  const onSubmit = handleSubmit(async (values) => {
    await quickstart.mutateAsync({
      name: values.name,
      notify_email: values.notify_email,
      origin: values.origin === "" ? undefined : values.origin,
    })
  })

  if (quickstart.data === undefined) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-8 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Postmark status="pending" tone="accent" size={52} />
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance md:text-5xl">
            Create your first form
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            One name, one inbox. We&apos;ll hand you a working endpoint and the snippet to
            drop into your site.
          </p>
        </div>

        <Card>
          <CardContent>
            <form
              onSubmit={(e) => {
                void onSubmit(e)
              }}
              className="flex flex-col gap-4"
              noValidate
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Form name</Label>
                <Input id="name" placeholder="Portfolio contact" {...register("name")} aria-invalid={errors.name !== undefined} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notify_email">Notify email</Label>
                <Input
                  id="notify_email"
                  type="email"
                  placeholder="you@example.com"
                  {...register("notify_email")}
                  aria-invalid={errors.notify_email !== undefined}
                />
                {errors.notify_email && <p className="text-xs text-destructive">{errors.notify_email.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="origin">
                  Site origin <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input id="origin" placeholder="https://faahim.dev" {...register("origin")} />
              </div>

              <Button type="submit" disabled={isSubmitting} className="mt-2 gap-1.5">
                {isSubmitting ? "Creating…" : "Create form"}
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <QuickstartResult formId={quickstart.data.form.id} embed={quickstart.data.embed} verifyCurl={quickstart.data.verify.curl} />
}

function QuickstartResult({
  formId,
  embed,
  verifyCurl,
}: {
  readonly formId: string
  readonly embed: { readonly html: string; readonly fetch: string; readonly react: string; readonly astro: string; readonly nextjs_action: string }
  readonly verifyCurl: string
}) {
  const submissions = useFormSubmissions(formId, { poll: true })
  const first = submissions.data?.data[0]
  const hasReceived = first !== undefined

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Postmark status="sent" tone="accent" size={48} />
        <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance md:text-5xl">
          Your form is live
        </h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Drop this into your site, or send a test submission with curl.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Embed</CardTitle>
        </CardHeader>
        <CardContent>
          <EmbedSnippetTabs embed={embed} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Terminal className="size-4" />
            Or verify with curl
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="overflow-auto rounded-lg border border-border/70 bg-muted/50 p-4 pr-20 font-mono text-[13px] leading-relaxed">
              <code>{verifyCurl}</code>
            </pre>
            <CopyButton value={verifyCurl} className="absolute top-2.5 right-2.5" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className={`t-skel min-h-24 ${hasReceived ? "is-revealed" : ""}`}>
            <div className={`t-skel-skeleton flex flex-col items-center justify-center gap-3 py-4 text-center ${hasReceived ? "" : "is-pulsing"}`}>
              <Postmark status="pending" size={32} />
              <p className="text-sm text-muted-foreground">Waiting for your first submission…</p>
            </div>
            <div className="t-skel-content flex flex-col gap-3">
              {first !== undefined && (
                <>
                  <div className="flex items-center gap-2">
                    <Postmark status="sent" tone="accent" size={20} />
                    <p className="text-sm font-medium text-foreground">It arrived.</p>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">{formatDateTime(first.received_at)}</span>
                  </div>
                  <dl className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
                    {Object.entries(first.data)
                      .slice(0, 4)
                      .map(([key, value], i) => (
                        <div
                          key={key}
                          className="flex flex-col gap-0.5 px-3 py-2 animate-in fade-in-0 slide-in-from-bottom-1"
                          style={{ animationDelay: `${i * 60}ms`, animationDuration: "var(--duration-slow)", animationFillMode: "backwards" }}
                        >
                          <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
                          <dd className="truncate text-sm">{String(value)}</dd>
                        </div>
                      ))}
                  </dl>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
