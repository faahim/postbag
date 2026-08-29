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
  readonly attachmentIds?: readonly string[] | undefined
}

/**
 * POST a payload to a form's public submit endpoint (`POST /s/{formId}`) — no auth required.
 * Works from a browser or a server. Accepts either a bare form id (`fm_8f3kq2`, needs `baseUrl`)
 * or a full submit URL (as returned by `/v1/quickstart`).
 */
export async function submit(
  formIdOrUrl: string,
  data: Readonly<Record<string, unknown>> | FormData,
  opts: SubmitOptions = {},
): Promise<SubmitResult> {
  const fetchImpl = opts.fetch ?? globalThis.fetch
  const url = resolveSubmitUrl(formIdOrUrl, opts.baseUrl)
  const response =
    data instanceof FormData
      ? await fetchImpl(url, {
          method: "POST",
          body: opts.test === true ? withTestFlag(data) : data,
        })
      : await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts.test === true ? { ...data, _test: true } : data),
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
    readonly attachments?: readonly { readonly id: string }[]
  }
  return {
    ok: json.ok,
    submissionId: json.submission_id,
    status: json.status,
    deliveries: json.deliveries,
    attachmentIds: json.attachments?.map((attachment) => attachment.id),
  }
}

function withTestFlag(data: FormData): FormData {
  const clone = new FormData()
  data.forEach((value, key) => {
    clone.append(key, value)
  })
  clone.set("_test", "true")
  return clone
}

function resolveSubmitUrl(formIdOrUrl: string, baseUrl: string | undefined): string {
  if (formIdOrUrl.startsWith("http://") || formIdOrUrl.startsWith("https://")) return formIdOrUrl
  if (baseUrl === undefined) {
    throw new Error("submit(): pass a full submit URL, or a form id plus { baseUrl }.")
  }
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  return `${trimmedBase}/s/${formIdOrUrl}`
}
