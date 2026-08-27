export type Cadence = "instant" | "daily" | "weekly"

export type CadenceState = { readonly cadence: Cadence; readonly time: string; readonly weekday: number }

export const DEFAULT_CADENCE: CadenceState = { cadence: "instant", time: "08:00", weekday: 1 }

export function isCadenceComplete(state: CadenceState): boolean {
  if (state.cadence === "instant") return true
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(state.time)) return false
  return state.cadence !== "weekly" || (Number.isInteger(state.weekday) && state.weekday >= 0 && state.weekday <= 6)
}

export function isCadenceReady(state: CadenceState, timezone: string | undefined): boolean {
  return isCadenceComplete(state) && (state.cadence === "instant" || timezone !== undefined)
}

/** The dashboard offers the digest subset the worker supports (core `digestPeriodKey`): a fixed
 * minute and hour, every day or on one weekday. Anything fancier is an API/CLI job. */
export function modeFor(state: CadenceState, timezone: string) {
  if (state.cadence === "instant") return { type: "instant" as const }
  if (!isCadenceComplete(state)) throw new Error("Choose a complete digest time.")
  const [h, m] = state.time.split(":")
  const hour = Number(h)
  const minute = Number(m)
  const cron = `${minute} ${hour} * * ${state.cadence === "weekly" ? state.weekday : "*"}`
  return { type: "digest" as const, cron, timezone }
}

/** The reverse read, so an existing Route's mode opens in the same controls it was made with. */
export function cadenceStateFromMode(mode: { readonly type: string; readonly cron?: string }): CadenceState {
  if (mode.type !== "digest" || mode.cron === undefined) return DEFAULT_CADENCE
  const [minute = "0", hour = "8", , , dow = "*"] = mode.cron.trim().split(/\s+/u)
  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
  if (dow === "*") return { cadence: "daily", time, weekday: 1 }
  const weekday = Number(dow)
  return { cadence: "weekly", time, weekday: Number.isInteger(weekday) ? weekday : 1 }
}
