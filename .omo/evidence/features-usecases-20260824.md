# Features and Use Cases lane validation

## Scope

- `apps/site/src/pages/features/index.astro`
- `apps/site/src/pages/features/[slug].astro`
- `apps/site/src/pages/use-cases/index.astro`
- `apps/site/src/pages/use-cases/[slug].astro`
- `apps/site/src/content/usecases.ts`

## Contract check

Scenario: anonymous-first AI-built-site messaging distinguishes the bounded sandbox path from authenticated quickstart.

Invocation:

```sh
rg -n 'Start with the sandbox|five test Submissions|cannot create a Destination, Route, Delivery, Event or outbound traffic|Use quickstart when you already have a key|Bags' apps/server/src/llms.md apps/server/src/routes/v1/anonymousSandboxes.ts apps/site/src/content/usecases.ts apps/site/src/pages/features/index.astro
```

Observable: the public AI-built-sites content says the sandbox has a stable submit URL, accepts at most five test Submissions over 24 hours, and cannot create a Destination, Route, Delivery, Event or outbound traffic. It separately describes `POST /v1/quickstart` as the authenticated one-call routed path. The legacy public `Bags` display string is absent from this lane.

## Static quality gates

Scenario: all generated Feature and Use Case routes typecheck and build.

Invocations:

```sh
pnpm --filter @postbag/site typecheck
pnpm --filter @postbag/site build
pnpm lint
git diff --check
```

Observables:

- `astro check`: 0 errors, 0 warnings, 1 pre-existing Astro hint in `src/layouts/Base.astro:97`.
- `astro build`: 83 pages built, including `/features/`, all six `/features/[slug]/` routes, `/use-cases/`, and all five `/use-cases/[slug]/` routes; site postbuild clean passed.
- Root lint completed with exit code 0 after core, db, auth and SDK builds.
- `git diff --check` completed with exit code 0.

## Preview HTTP coverage

Scenario: built preview serves the changed index and detail routes with the expected titles.

Invocation:

```sh
node -e 'const paths=["/features/","/features/routing/","/features/self-hosting/","/use-cases/","/use-cases/ai-built-websites/","/use-cases/contact-form/"]; Promise.all(paths.map(async path=>{const response=await fetch("http://127.0.0.1:4325"+path);const html=await response.text();const title=(html.match(/<title>([^<]+)/)||[,""])[1];console.log(`${path} status=${response.status} bytes=${Buffer.byteLength(html)} title=${title}`)})).catch(error=>{console.error(error);process.exitCode=1})'
```

Observables:

- `/features/` returned `200`, `32344` bytes, `Features | Postbag`.
- `/features/routing/` returned `200`, `47860` bytes, `Routing: many forms, one shape, any destination | Postbag`.
- `/features/self-hosting/` returned `200`, `36874` bytes, `Self-hosting Postbag: one container, one Postgres`.
- `/use-cases/` returned `200`, `28860` bytes, `Use cases | Postbag`.
- `/use-cases/ai-built-websites/` returned `200`, `40995` bytes, `AI-built websites: leave a working Form behind before signup | Postbag`.
- `/use-cases/contact-form/` returned `200`, `42147` bytes, `Contact form backend for any website: one URL, one email, three minutes | Postbag`.

## Browser limitation

The preview remains available at `http://127.0.0.1:4325/`. The required Browser bridge could not be initialized in this workspace: the prescribed `agent.browsers.getForUrl(...)` call returned `agent is not defined` from the available Node REPL. No screenshot or browser-interaction claim is made in this lane. The integration owner should perform desktop, tablet, mobile and reduced-motion visual QA against the running preview.
