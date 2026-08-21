export type SubmitOptions = {
  /** Base URL to resolve a bare form id against, e.g. `https://api.postbag.dev`. Ignored if `formIdOrUrl` is already a URL. */
  readonly baseUrl?: string
  /** Mark this as a test submission (`_test: true`) — routed but never counted against quota. */
  readonly test?: boolean
  /** Override the underlying `fetch` implementation (Node/tests). */
  readonly fetch?: typeof globalThis.fetch
}

export type SubmitResult = {
  readonly ok: boolean
  readonly submissionId: string
  readonly status: "received" | "quarantined" | "spam"
  readonly deliveries?: readonly string[] | undefined
}

/**
 * POST a payload to a form's public submit endpoint (`POST /s/{formId}`) — no auth required.
 * Works from a browser or a server. Accepts either a bare form id (`fm_8f3kq2`, needs `baseUrl`)
 * or a full submit URL (as returned by `/v1/quickstart`).
 */
export async function submit(
  formIdOrUrl: string,
  data: Readonly<Record<string, unknown>>,
  opts: SubmitOptions = {},
): Promise<SubmitResult> {
  const fetchImpl = opts.fetch ?? globalThis.fetch
  const url = resolveSubmitUrl(formIdOrUrl, opts.baseUrl)
  const body = opts.test === true ? { ...data, _test: true } : data

  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Postbag submit failed (${response.status.toString()}): ${text}`)
  }

  const json = (await response.json()) as {
    readonly ok: boolean
    readonly submission_id: string
    readonly status: "received" | "quarantined" | "spam"
    readonly deliveries?: readonly string[]
  }
  return {
    ok: json.ok,
    submissionId: json.submission_id,
    status: json.status,
    deliveries: json.deliveries,
  }
}

function resolveSubmitUrl(formIdOrUrl: string, baseUrl: string | undefined): string {
  if (formIdOrUrl.startsWith("http://") || formIdOrUrl.startsWith("https://")) return formIdOrUrl
  if (baseUrl === undefined) {
    throw new Error("submit(): pass a full submit URL, or a form id plus { baseUrl }.")
  }
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  return `${trimmedBase}/s/${formIdOrUrl}`
}
