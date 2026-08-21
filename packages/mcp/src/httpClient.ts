import type { ResolvedConfig } from "./config.js"

export type FetchLike = typeof fetch

export interface ApiClientOptions extends ResolvedConfig {
  readonly fetchImpl?: FetchLike
}

export interface ApiJsonResult {
  readonly ok: boolean
  readonly status: number
  readonly body: unknown
}

function joinUrl(apiUrl: string, path: string): string {
  const base = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `${base}${suffix}`
}

/** Calls a Postbag `/v1` (or `/s`) JSON endpoint with the bearer key and returns the parsed body. */
export async function callJsonApi(
  options: ApiClientOptions,
  method: string,
  path: string,
  body: unknown,
): Promise<ApiJsonResult> {
  const doFetch = options.fetchImpl ?? fetch
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    Accept: "application/json",
  }
  if (body !== undefined) headers["Content-Type"] = "application/json"

  const response = await doFetch(joinUrl(options.apiUrl, path), {
    method: method.toUpperCase(),
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  const text = await response.text()
  let parsedBody: unknown = null
  if (text.length > 0) {
    try {
      parsedBody = JSON.parse(text)
    } catch {
      parsedBody = text
    }
  }

  return { ok: response.ok, status: response.status, body: parsedBody }
}

export interface ApiTextResult {
  readonly ok: boolean
  readonly status: number
  readonly text: string
}

/** Calls a plain-text Postbag endpoint (`/llms.txt`) with the bearer key. */
export async function callTextApi(options: ApiClientOptions, path: string): Promise<ApiTextResult> {
  const doFetch = options.fetchImpl ?? fetch
  const response = await doFetch(joinUrl(options.apiUrl, path), {
    method: "GET",
    headers: { Authorization: `Bearer ${options.apiKey}`, Accept: "text/markdown, text/plain" },
  })
  const text = await response.text()
  return { ok: response.ok, status: response.status, text }
}
