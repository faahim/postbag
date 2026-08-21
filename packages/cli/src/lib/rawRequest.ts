import type { Ctx } from "./context.js"

export type RawResult = {
  readonly ok: boolean
  readonly status: number
  readonly json: unknown
  readonly text: string
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url
}

/**
 * A raw HTTP request against the configured API base URL, for endpoints outside the
 * typed `/v1` surface (`/llms.txt`, `/openapi.json`) and the `postbag api` escape hatch.
 */
export async function rawRequest(
  ctx: Ctx,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<RawResult> {
  const url = `${trimTrailingSlash(ctx.apiUrl)}${path.startsWith("/") ? path : `/${path}`}`
  const headers: Record<string, string> = {}
  if (ctx.apiKey !== undefined) headers["Authorization"] = `Bearer ${ctx.apiKey}`
  if (body !== undefined) headers["Content-Type"] = "application/json"

  const response = await ctx.deps.fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  const contentType = response.headers.get("content-type") ?? ""
  let json: unknown
  if (contentType.includes("json") && text !== "") {
    try {
      json = JSON.parse(text)
    } catch {
      json = undefined
    }
  }
  return { ok: response.ok, status: response.status, json, text }
}
