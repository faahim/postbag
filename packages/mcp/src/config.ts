export const DEFAULT_API_URL = "https://postbag.dev"

export interface ResolvedConfig {
  readonly apiKey: string
  readonly apiUrl: string
}

export interface ConfigError {
  readonly error: string
}

function readFlag(argv: readonly string[], flag: string): string | undefined {
  const eq = `${flag}=`
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === undefined) continue
    if (arg === flag) return argv[i + 1]
    if (arg.startsWith(eq)) return arg.slice(eq.length)
  }
  return undefined
}

/**
 * Config resolution order: `--api-key`/`--api-url` argv flags win over `POSTBAG_API_KEY`/
 * `POSTBAG_API_URL` env vars. `apiUrl` defaults to the hosted product; `apiKey` is required.
 */
export function resolveConfig(argv: readonly string[], env: NodeJS.ProcessEnv): ResolvedConfig | ConfigError {
  const apiKey = readFlag(argv, "--api-key") ?? env["POSTBAG_API_KEY"]
  const apiUrl = readFlag(argv, "--api-url") ?? env["POSTBAG_API_URL"] ?? DEFAULT_API_URL

  if (apiKey === undefined || apiKey.length === 0) {
    return {
      error:
        "POSTBAG_API_KEY is required (env var or --api-key flag). " +
        "Mint one at https://postbag.dev/app (Settings -> API keys) or with `postbag login`.",
    }
  }

  return { apiKey, apiUrl }
}
