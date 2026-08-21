import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/** One saved login: where to talk to Postbag, and with which key. */
export type CredentialsProfile = {
  readonly api_url?: string
  readonly api_key?: string
}

/** Shape of `~/.config/postbag/credentials.json` (path respects `XDG_CONFIG_HOME`). */
export type CredentialsFile = {
  readonly profiles: Record<string, CredentialsProfile>
  readonly current: string
}

/** Shape of `postbag.json` written by `postbag init` and read by other commands. */
export type PostbagJsonFile = {
  readonly form_id?: string
  readonly submit_url?: string
  readonly project?: string
  readonly api_url?: string
  readonly [key: string]: unknown
}

export const DEFAULT_API_URL = "https://postbag.dev"
const DEFAULT_PROFILE = "default"

/** Everything config resolution needs, injected so it never reaches for `process.*` directly. */
export type ConfigEnv = {
  readonly env: Readonly<Record<string, string | undefined>>
  readonly cwd: string
  readonly homeDir: string
}

export function defaultConfigEnv(): ConfigEnv {
  return { env: process.env, cwd: process.cwd(), homeDir: homedir() }
}

/** `~/.config` (or `$XDG_CONFIG_HOME`) + `postbag/credentials.json`. */
export function credentialsPath(configEnv: ConfigEnv): string {
  const base = configEnv.env["XDG_CONFIG_HOME"] ?? join(configEnv.homeDir, ".config")
  return join(base, "postbag", "credentials.json")
}

export function postbagJsonPath(cwd: string): string {
  return join(cwd, "postbag.json")
}

export function readCredentials(configEnv: ConfigEnv): CredentialsFile | undefined {
  const parsed = readJsonFile(credentialsPath(configEnv))
  return parsed === undefined ? undefined : (parsed as CredentialsFile)
}

export function readPostbagJson(cwd: string): PostbagJsonFile | undefined {
  const parsed = readJsonFile(postbagJsonPath(cwd))
  return parsed === undefined ? undefined : (parsed as PostbagJsonFile)
}

/** Writes the credentials file with mode `0600`, creating the parent directory if needed. */
export function writeCredentials(configEnv: ConfigEnv, file: CredentialsFile): void {
  const path = credentialsPath(configEnv)
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 })
  // `writeFileSync`'s mode is masked by the process umask; force it so the file
  // never ends up group/world readable regardless of the caller's umask.
  chmodSync(path, 0o600)
}

/** Merges `patch` into the existing `postbag.json` (if any) and writes it back. */
export function writePostbagJson(cwd: string, patch: PostbagJsonFile): PostbagJsonFile {
  const existing = readPostbagJson(cwd) ?? {}
  const merged: PostbagJsonFile = { ...existing, ...patch }
  writeFileSync(postbagJsonPath(cwd), `${JSON.stringify(merged, null, 2)}\n`)
  return merged
}

/** Saves (or replaces) one profile and makes it current. */
export function saveProfile(configEnv: ConfigEnv, profileName: string, profile: CredentialsProfile): void {
  const existing = readCredentials(configEnv) ?? { profiles: {}, current: DEFAULT_PROFILE }
  const next: CredentialsFile = {
    profiles: { ...existing.profiles, [profileName]: profile },
    current: profileName,
  }
  writeCredentials(configEnv, next)
}

/** Removes the current profile. Leaves other profiles untouched. */
export function removeCurrentProfile(configEnv: ConfigEnv): boolean {
  const existing = readCredentials(configEnv)
  if (existing === undefined) return false
  const profile = existing.profiles[existing.current]
  if (profile === undefined) return false
  const profiles = { ...existing.profiles }
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- keying by the resolved current profile name is intentional
  delete profiles[existing.current]
  writeCredentials(configEnv, { profiles, current: existing.current })
  return true
}

export type ResolvedConfig = {
  readonly apiUrl: string
  readonly apiKey: string | undefined
}

export type ConfigFlags = {
  readonly apiKey?: string
  readonly apiUrl?: string
}

/**
 * Config resolution, first source wins: `--api-key`/`--api-url` flags, then
 * `POSTBAG_API_KEY`/`POSTBAG_API_URL` env vars, then `postbag.json` in the cwd
 * (`api_url` only), then `~/.config/postbag/credentials.json`, then the default API URL.
 */
export function resolveConfig(flags: ConfigFlags, configEnv: ConfigEnv): ResolvedConfig {
  const postbagJson = readPostbagJson(configEnv.cwd)
  const credentials = readCredentials(configEnv)
  const profile = credentials?.profiles[credentials.current]

  const apiUrl =
    flags.apiUrl ??
    configEnv.env["POSTBAG_API_URL"] ??
    postbagJson?.api_url ??
    profile?.api_url ??
    DEFAULT_API_URL

  const apiKey = flags.apiKey ?? configEnv.env["POSTBAG_API_KEY"] ?? profile?.api_key

  return { apiUrl, apiKey }
}

function readJsonFile(path: string): unknown {
  if (!existsSync(path)) return undefined
  const raw = readFileSync(path, "utf8")
  return JSON.parse(raw) as unknown
}
