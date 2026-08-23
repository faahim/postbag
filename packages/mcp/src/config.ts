export const DEFAULT_API_URL = "https://postbag.dev"

export interface ResolvedConfig {
  readonly apiKey?: string
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
 * `POSTBAG_API_URL` env vars. `apiUrl` defaults to the hosted product. The key is optional
 * so an agent can use the public sandbox operations before it authenticates; tenant tools
 * return the API's normal 401 until a key is configured.
 */
export function resolveConfig(argv: readonly string[], env: NodeJS.ProcessEnv): ResolvedConfig {
  const apiKey = readFlag(argv, "--api-key") ?? env["POSTBAG_API_KEY"]
  const apiUrl = readFlag(argv, "--api-url") ?? env["POSTBAG_API_URL"] ?? DEFAULT_API_URL
  return { apiUrl, ...(apiKey === undefined || apiKey.length === 0 ? {} : { apiKey }) }
}
