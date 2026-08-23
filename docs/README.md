# Postbag documentation

| Read this                                    | When                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [`../PROGRESS.md`](../PROGRESS.md)           | To see what is deployed now, the exact production resources and gates, and what remains next. This is the live operational blueprint.      |
| [`PRINCIPLES.md`](./PRINCIPLES.md)           | Before designing or building anything. The product constraints every feature is checked against.                                           |
| [`DOMAIN-MODEL.md`](./DOMAIN-MODEL.md)       | To understand the nouns: Form, Submission, Stream, Schema, Mapping, Destination, Route, Delivery.                                          |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)       | How it runs: the outbox, the worker, the submit path, spam, deliverability, multi-tenancy.                                                 |
| [`AGENT-NATIVE.md`](./AGENT-NATIVE.md)       | What "agent-native" means concretely: the API surface, MCP, CLI, discoverability, the quickstart call.                                     |
| [`DESIGN.md`](./DESIGN.md)                   | Before any UI work. shadcn/ui foundation, the identity coat, feel rules, and the mandatory design skills.                                  |
| [`ROADMAP.md`](./ROADMAP.md)                 | Phases, what ships when, and what is deliberately deferred.                                                                                |
| [`decisions/`](./decisions/)                 | Architecture Decision Records. One file per decision; never edit history, supersede instead.                                               |
| [`../api/openapi.yaml`](../api/openapi.yaml) | The API contract. In Phase 0 it is hand-written; from Phase 1 it is generated from the route definitions and this file becomes a snapshot. |

## Conventions

- Documents describe the **intended** system. Where the code disagrees with a doc, one of them is a bug — say which in the PR.
- A decision worth arguing about becomes an ADR. A decision nobody will argue about goes in the relevant doc.
- Vocabulary is fixed in `PRINCIPLES.md` §3. Do not invent synonyms.
