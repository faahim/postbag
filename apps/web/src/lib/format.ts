const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["week", 1000 * 60 * 60 * 24 * 7],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
]

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

/** "3 minutes ago", "just now", "in 2 hours" — used for last-submission and delivery times. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  const diffMs = then - now.getTime()
  const absMs = Math.abs(diffMs)

  if (absMs < 1000 * 45) return "just now"

  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (absMs >= unitMs || unit === "minute") {
      const value = Math.round(diffMs / unitMs)
      return relativeFormatter.format(value, unit)
    }
  }
  return "just now"
}

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}

const countFormatter = new Intl.NumberFormat("en")

export function formatCount(value: number): string {
  return countFormatter.format(value)
}

/** `fm_8f3kq2` — Postbag's prefixed ids, always rendered in mono with the prefix dimmed. */
export function splitPrefixedId(id: string): { readonly prefix: string; readonly rest: string } {
  const underscoreIndex = id.indexOf("_")
  if (underscoreIndex === -1) return { prefix: "", rest: id }
  return { prefix: id.slice(0, underscoreIndex + 1), rest: id.slice(underscoreIndex + 1) }
}
