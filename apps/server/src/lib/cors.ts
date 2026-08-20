export type CorsDecision = { readonly allowOrigin: string | null }

export function decideCors(
  requestOrigin: string | undefined,
  allowedOrigins: readonly string[],
): CorsDecision {
  if (allowedOrigins.length === 0) return { allowOrigin: "*" }
  if (requestOrigin !== undefined && allowedOrigins.includes(requestOrigin)) {
    return { allowOrigin: requestOrigin }
  }
  return { allowOrigin: null }
}
