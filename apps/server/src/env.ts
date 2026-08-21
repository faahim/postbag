import { z } from "zod"

const BooleanFromString = z
  .string()
  .optional()
  .transform((value) => value !== "false" && value !== "0")

// Defaults false (unlike BooleanFromString above, which defaults true) — RLS_ENFORCED
// must stay off until an operator opts in explicitly. See job D §5 / migration
// 0003_rls_second_fence.sql: the flag is defined and the database-level fence (role +
// policies) is fully wired and tested, but the request-path integration (SET LOCAL ROLE
// + SET LOCAL app.org_id per org-scoped request) is NOT implemented — see PROGRESS.md.
const BooleanFlagDefaultFalse = z
  .string()
  .optional()
  .transform((value) => value === "true" || value === "1")

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  POSTBAG_ROLE: z.enum(["api", "worker", "all"]).default("all"),
  TZ: z.string().default("UTC"),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Postbag <notify@postbag.dev>"),
  MIGRATE_ON_BOOT: BooleanFromString,
  RLS_ENFORCED: BooleanFlagDefaultFalse,
  // Comma-separated hostnames (e.g. an old custom domain) that should 301-redirect
  // marketing/dashboard paths to APP_URL, while /s/, /v1/ and /health keep working on the
  // old host forever so embeds already deployed to production sites never break. Empty by
  // default — self-host operators only set this if they are migrating domains.
  LEGACY_HOSTS: z
    .string()
    .optional()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter((host) => host.length > 0),
    ),
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
  readonly RLS_ENFORCED: boolean
  readonly LEGACY_HOSTS: readonly string[]
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
