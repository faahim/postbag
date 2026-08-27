export function timeZoneOptions(supported: readonly string[], current: string): string[] {
  return [...new Set(["UTC", current, ...supported])]
}
