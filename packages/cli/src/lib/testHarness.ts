import { PassThrough } from "node:stream"

import type { CliDeps } from "./context.js"

export type FakeResponse = {
  readonly status?: number
  readonly body?: unknown
  readonly headers?: Readonly<Record<string, string>>
}

export type RecordedRequest = {
  readonly url: string
  readonly method: string
  readonly body: string | undefined
  readonly headers: Record<string, string>
}

export type Harness = {
  readonly deps: CliDeps
  readonly logs: string[]
  readonly errors: string[]
  readonly requests: RecordedRequest[]
}

export type HarnessOptions = {
  /** Called for every fetch; return a response (default: `{status: 200, body: {}}`). */
  readonly handleFetch?: (req: RecordedRequest) => FakeResponse | Promise<FakeResponse>
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly cwd?: string
  readonly homeDir?: string
  readonly stdoutIsTty?: boolean
}

/** Builds a `CliDeps` with a fake `fetch`, an isolated env/cwd/home, and capturing log/error sinks. */
export function createHarness(opts: HarnessOptions): Harness {
  const logs: string[] = []
  const errors: string[] = []
  const requests: RecordedRequest[] = []

  // `openapi-fetch` (used by every SDK-backed command) calls its custom `fetch` with a single,
  // already-built `Request` — headers/method/body all live on it. `rawRequest.ts` (used by
  // `explain`/`openapi`/`api`) calls the ordinary two-argument `fetch(url, init)` form instead.
  // Both must resolve to the same recorded shape here.
  const fetchImpl: typeof fetch = async (input, init) => {
    let url: string
    let method: string
    let headersSource: HeadersInit | undefined
    let body: string | undefined

    if (input instanceof Request) {
      url = input.url
      method = input.method
      headersSource = input.headers
      body = input.body === null ? undefined : await input.clone().text()
    } else {
      url = typeof input === "string" ? input : input.toString()
      method = init?.method ?? "GET"
      headersSource = init?.headers
      body = typeof init?.body === "string" ? init.body : undefined
    }

    const headers: Record<string, string> = {}
    new Headers(headersSource).forEach((value, key) => {
      headers[key] = value
    })
    const record: RecordedRequest = { url, method, body, headers }
    requests.push(record)

    const fake = opts.handleFetch === undefined ? {} : await opts.handleFetch(record)
    const status = fake.status ?? 200
    const responseBody = fake.body === undefined ? "" : JSON.stringify(fake.body)
    const responseHeaders = { "content-type": "application/json", ...(fake.headers ?? {}) }
    return Promise.resolve(new Response(responseBody, { status, headers: responseHeaders }))
  }

  const deps: CliDeps = {
    fetch: fetchImpl,
    env: opts.env ?? {},
    cwd: opts.cwd ?? "/tmp",
    homeDir: opts.homeDir ?? "/tmp/home",
    stdoutIsTty: opts.stdoutIsTty ?? false,
    io: {
      log: (line) => {
        logs.push(line)
      },
      error: (line) => {
        errors.push(line)
      },
    },
    // Real (unconnected) streams — satisfy `readline`'s types exactly. Tests exercise
    // `--yes`/flag-driven paths that never prompt, so nothing needs to write to these.
    promptIo: { input: new PassThrough(), output: new PassThrough() },
  }

  return { deps, logs, errors, requests }
}
