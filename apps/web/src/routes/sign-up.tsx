import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { AuthSplitLayout } from "@/components/auth-split-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUp } from "@/lib/auth-client"
import { signUpSchema, type SignUpValues } from "@/lib/auth-schemas"

export const Route = createFileRoute("/sign-up")({
  component: SignUpRoute,
})

function SignUpRoute() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const { error } = await signUp.email({ name: values.name, email: values.email, password: values.password })
    if (error) {
      setFormError(error.message ?? "Could not create your account.")
      return
    }
    // First-run: sole persona test — under three minutes from signup to the embed snippet.
    await navigate({ to: "/first-run" })
  })

  return (
    <AuthSplitLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-semibold text-balance">Create your workspace</h2>
          <p className="text-sm text-muted-foreground">One form and one email, in under three minutes.</p>
        </div>

        <form
          onSubmit={(e) => {
            void onSubmit(e)
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" autoComplete="name" placeholder="Ada Lovelace" {...register("name")} aria-invalid={errors.name !== undefined} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} aria-invalid={errors.email !== undefined} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              {...register("password")}
              aria-invalid={errors.password !== undefined}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {formError !== null && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Creating your workspace…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have a workspace?{" "}
          <Link to="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  )
}
