/**
 * Casts a dynamically-built request body or query object (flags merged over `--data`,
 * or plain flag values) to the SDK's generated type for the operation. The API is the
 * source of truth for validation; this only tells TypeScript "trust the shape we built
 * at runtime" — in particular that `exactOptionalPropertyTypes` won't see the `undefined`
 * a not-passed flag carries at the type level, even though we never actually send it
 * (openapi-fetch / JSON.stringify both drop `undefined` values).
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the whole point is an explicit `asBody<SomeOperationBody>(...)` cast at each call site
export function asBody<T>(value: Record<string, unknown>): T {
  return value as unknown as T
}

/** The JSON request body type of a generated `operations["..."]` entry, unwrapping the optional `requestBody`. */
export type JsonBody<Op extends { requestBody?: { content: { "application/json": unknown } } }> = NonNullable<
  Op["requestBody"]
>["content"]["application/json"]
