import { PostbagError } from "@postbag/core"

export const API_KEY_SCOPES = ["manage", "read", "submit"] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]
export type ScopedApiKey = { readonly metadata?: unknown }

// Scope implication: `manage` ⊇ `read` ⊇ `submit`. A key granted a broader scope carries
// every narrower one implicitly — `requireScope('read')` accepts a `manage` key without the
// caller having to request both explicitly.
const SCOPE_IMPLICATIONS: Readonly<Record<ApiKeyScope, readonly ApiKeyScope[]>> = {
  manage: ["manage", "read", "submit"],
  read: ["read", "submit"],
  submit: ["submit"],
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isScope(value: unknown): value is ApiKeyScope {
  return typeof value === "string" && API_KEY_SCOPES.some((scope) => scope === value)
}

/** Expands granted scopes to include everything they imply, e.g. `["manage"]` → `["manage", "read", "submit"]`. */
export function expandScopes(scopes: readonly ApiKeyScope[]): readonly ApiKeyScope[] {
  const expanded = new Set<ApiKeyScope>()
  for (const scope of scopes) {
    for (const implied of SCOPE_IMPLICATIONS[scope]) expanded.add(implied)
  }
  return API_KEY_SCOPES.filter((scope) => expanded.has(scope))
}

export function scopesFromKey(key: ScopedApiKey): readonly ApiKeyScope[] {
  if (!isRecord(key.metadata)) return []
  const scopes = key.metadata["scopes"]
  if (!Array.isArray(scopes)) return []
  return scopes.filter(isScope)
}

export function hasScope(key: ScopedApiKey, scope: ApiKeyScope): boolean {
  return expandScopes(scopesFromKey(key)).includes(scope)
}

export function requireScope<T extends ScopedApiKey>(key: T, scope: ApiKeyScope): T {
  if (!hasScope(key, scope)) {
    throw new PostbagError("forbidden", `This API key does not grant the '${scope}' scope.`, {
      required_scope: scope,
    })
  }
  return key
}
