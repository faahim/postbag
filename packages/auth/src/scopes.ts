import { PostbagError } from "@postbag/core"

export const API_KEY_SCOPES = ["manage", "read", "submit"] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]
export type ScopedApiKey = { readonly metadata?: unknown }

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isScope(value: unknown): value is ApiKeyScope {
  return typeof value === "string" && API_KEY_SCOPES.some((scope) => scope === value)
}

export function hasScope(key: ScopedApiKey, scope: ApiKeyScope): boolean {
  if (!isRecord(key.metadata)) return false
  const scopes = key.metadata["scopes"]
  return Array.isArray(scopes) && scopes.some((value) => isScope(value) && value === scope)
}

export function requireScope<T extends ScopedApiKey>(key: T, scope: ApiKeyScope): T {
  if (!hasScope(key, scope)) {
    throw new PostbagError("forbidden", `This API key does not grant the '${scope}' scope.`, {
      required_scope: scope,
    })
  }
  return key
}
