import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { AuthSplitLayout } from "@/components/auth-split-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/lib/auth-client"
import { signInSchema, type SignInValues } from "@/lib/auth-schemas"

export const Route = createFileRoute("/sign-in")({
  component: SignInRoute,
})

function SignInRoute() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const { error } = await signIn.email({ email: values.email, password: values.password })
    if (error) {
      setFormError(error.message ?? "Could not sign in. Check your email and password.")
      return
    }
    await navigate({ to: "/" })
  })

  return (
    <AuthSplitLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-semibold text-balance">Welcome back</h2>
          <p className="text-sm text-muted-foreground">Sign in to your Postbag workspace.</p>
        </div>

        <form
          onSubmit={(e) => {
            void onSubmit(e)
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} aria-invalid={errors.email !== undefined} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
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
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New to Postbag?{" "}
          <Link to="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  )
}
