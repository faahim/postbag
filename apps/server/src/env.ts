import { z } from "zod"

const BooleanFromString = z
  .string()
  .optional()
  .transform((value) => value !== "false" && value !== "0")

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  POSTBAG_ROLE: z.enum(["api", "worker", "all"]).default("all"),
  TZ: z.string().default("UTC"),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Postbag <postbag@updates.withfaahim.com>"),
  MIGRATE_ON_BOOT: BooleanFromString,
})

export type Env = {
  readonly DATABASE_URL: string
  readonly NODE_ENV: "development" | "production" | "test"
  readonly PORT: number
  readonly APP_URL: string
  readonly BETTER_AUTH_SECRET: string
  readonly POSTBAG_ROLE: "api" | "worker" | "all"
  readonly TZ: string
  readonly RESEND_API_KEY?: string | undefined
  readonly MAIL_FROM: string
  readonly MIGRATE_ON_BOOT: boolean
}

export function loadEnv(source: Readonly<Record<string, string | undefined>> = process.env): Env {
  const result = EnvSchema.safeParse(source)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")
    throw new Error(`Invalid environment configuration: ${details}`)
  }
  return result.data
}
