export type CorsDecision = { readonly allowOrigin: string | null }

function canonicalOrigin(value: string): string | null {
  if (!URL.canParse(value)) return null
  return new URL(value).origin
}

export function decideCors(
  requestOrigin: string | undefined,
  allowedOrigins: readonly string[],
): CorsDecision {
  if (allowedOrigins.length === 0) return { allowOrigin: "*" }
  if (requestOrigin === undefined) return { allowOrigin: null }
  const origin = canonicalOrigin(requestOrigin)
  if (origin !== null && allowedOrigins.some((allowed) => canonicalOrigin(allowed) === origin)) {
    return { allowOrigin: requestOrigin }
  }
  return { allowOrigin: null }
}
