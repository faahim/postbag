import type { ApiKeyScope } from "@postbag/auth"
import { PostbagError } from "@postbag/core"

export type ScopeActor =
  | { readonly type: "session"; readonly userId: string }
  | { readonly type: "api_key"; readonly apiKeyId: string }

export type RequestScope = {
  readonly organizationId: string
  readonly actor: ScopeActor
  readonly scopes: readonly ApiKeyScope[]
}

export type Variables = {
  scope: RequestScope
  requestId: string
}

export type AppEnv = { readonly Variables: Variables }

export function assertScope(scope: RequestScope, required: ApiKeyScope): void {
  if (!scope.scopes.includes(required)) {
    throw new PostbagError("forbidden", `This credential does not grant the '${required}' scope.`, {
      required_scope: required,
    })
  }
}

export function assertSessionActor(scope: RequestScope, message: string): void {
  if (scope.actor.type !== "session") {
    throw new PostbagError("forbidden", message)
  }
}
