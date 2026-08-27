const CSS_DURATION = /^([0-9]*\.?[0-9]+)\s*(ms|s)$/iu

export function parseCssDurationMs(raw: string, fallback: number): number {
  const match = CSS_DURATION.exec(raw.trim())
  if (match === null) return fallback

  const value = Number.parseFloat(match[1] ?? "")
  if (!Number.isFinite(value)) return fallback
  return match[2]?.toLowerCase() === "s" ? value * 1000 : value
}

export function readCssDurationMs(style: CSSStyleDeclaration, name: string, fallback: number): number {
  return parseCssDurationMs(style.getPropertyValue(name), fallback)
}
