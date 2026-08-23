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

// Self-host parity (Principle 7): social login is entirely optional. A provider is
// enabled iff both its client id and secret are set; a half-configured pair throws at
// boot (superRefine below), naming the missing variable, rather than silently no-op-ing.
const EnvSchema = z
  .object({
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
    ANONYMOUS_QUICKSTART_ENABLED: BooleanFlagDefaultFalse,
    ANONYMOUS_SANDBOX_GLOBAL_LIMIT: z.coerce.number().int().positive().default(1000),
    POLAR_ACCESS_TOKEN: z.string().optional(),
    POLAR_WEBHOOK_SECRET: z.string().optional(),
    POLAR_SERVER: z.enum(["production", "sandbox"]).default("production"),
    POLAR_PRO_MONTHLY_PRODUCT_ID: z.string().optional(),
    POLAR_PRO_YEARLY_PRODUCT_ID: z.string().optional(),
    POLAR_TEAM_MONTHLY_PRODUCT_ID: z.string().optional(),
    POLAR_TEAM_YEARLY_PRODUCT_ID: z.string().optional(),
    // Social login (job G): optional, self-host parity. See the pair check below.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
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
    // Job K: comma-separated emails allowed to mint/list/revoke plan_grants
    // (POST/GET /v1/admin/plan-grants*). Empty by default so a self-hosted operator who
    // never sets this never sees the endpoint exist (it answers 404 not_found) — see
    // apps/server/src/lib/platformAdmin.ts.
    PLATFORM_ADMIN_EMAILS: z
      .string()
      .optional()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter((email) => email.length > 0),
      ),
  })
  .superRefine((data, ctx) => {
    const pairs: readonly [string, string | undefined, string, string | undefined][] = [
      [
        "GOOGLE_CLIENT_ID",
        data.GOOGLE_CLIENT_ID,
        "GOOGLE_CLIENT_SECRET",
        data.GOOGLE_CLIENT_SECRET,
      ],
      [
        "GITHUB_CLIENT_ID",
        data.GITHUB_CLIENT_ID,
        "GITHUB_CLIENT_SECRET",
        data.GITHUB_CLIENT_SECRET,
      ],
    ]
    for (const [idKey, idValue, secretKey, secretValue] of pairs) {
      const hasId = idValue !== undefined && idValue.length > 0
      const hasSecret = secretValue !== undefined && secretValue.length > 0
      if (hasId && !hasSecret) {
        ctx.addIssue({
          code: "custom",
          path: [secretKey],
          message: `${secretKey} is required because ${idKey} is set — set both or leave both unset to disable this provider.`,
        })
      } else if (!hasId && hasSecret) {
        ctx.addIssue({
          code: "custom",
          path: [idKey],
          message: `${idKey} is required because ${secretKey} is set — set both or leave both unset to disable this provider.`,
        })
      }
    }
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
  readonly ANONYMOUS_QUICKSTART_ENABLED: boolean
  readonly ANONYMOUS_SANDBOX_GLOBAL_LIMIT: number
  readonly POLAR_ACCESS_TOKEN?: string | undefined
  readonly POLAR_WEBHOOK_SECRET?: string | undefined
  readonly POLAR_SERVER: "production" | "sandbox"
  readonly POLAR_PRO_MONTHLY_PRODUCT_ID?: string | undefined
  readonly POLAR_PRO_YEARLY_PRODUCT_ID?: string | undefined
  readonly POLAR_TEAM_MONTHLY_PRODUCT_ID?: string | undefined
  readonly POLAR_TEAM_YEARLY_PRODUCT_ID?: string | undefined
  readonly GOOGLE_CLIENT_ID?: string | undefined
  readonly GOOGLE_CLIENT_SECRET?: string | undefined
  readonly GITHUB_CLIENT_ID?: string | undefined
  readonly GITHUB_CLIENT_SECRET?: string | undefined
  readonly LEGACY_HOSTS: readonly string[]
  readonly PLATFORM_ADMIN_EMAILS: readonly string[]
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
