import { UnsupportedDigestCron } from "./errors.js"

export type RoutingSubmission = {
  readonly id: string
  readonly status: "received" | "quarantined" | "spam"
  readonly receivedAt: Date
}
export type RoutingForm = {
  readonly status: "active" | "paused"
  readonly schemaVersion: number | null
}
export type RouteMode =
  | { readonly type: "instant" }
  | { readonly type: "digest"; readonly cron: string; readonly timezone: string }
export type RoutingRoute = {
  readonly id: string
  readonly destinationId: string
  readonly enabled: boolean
  readonly window?: { readonly from?: Date | null; readonly until?: Date | null }
  readonly quality?: { readonly excludeSpam?: boolean; readonly excludeQuarantined?: boolean }
  readonly mode?: RouteMode
}
export type StreamMembership = {
  readonly streamId: string
  readonly schemaVersion: number | null
  readonly routes: readonly RoutingRoute[]
}
export type DeliveryPlan = {
  readonly routeId: string
  readonly destinationId: string
  readonly streamId: string | null
  readonly status: "pending" | "skipped"
  readonly skipReason?: "window" | "quality" | "paused"
  readonly schemaVersion: number | null
  readonly digestPeriodKey?: string
}
export type PlanDeliveriesInput = {
  readonly submission: RoutingSubmission
  readonly form: RoutingForm
  readonly directRoutes: readonly RoutingRoute[]
  readonly streamMemberships: readonly StreamMembership[]
}

type LocalDateTime = {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
  readonly weekday: number
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function numberedPart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const value = parts.find((part) => part.type === type)?.value
  if (value === undefined) throw new UnsupportedDigestCron("invalid timezone result")
  return Number.parseInt(value, 10)
}

function localDateTime(date: Date, timezone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date)
  const weekdayName = parts.find((part) => part.type === "weekday")?.value
  const weekday = WEEKDAYS.findIndex((value) => value === weekdayName)
  if (weekday < 0) throw new UnsupportedDigestCron("invalid timezone weekday")
  return {
    year: numberedPart(parts, "year"),
    month: numberedPart(parts, "month"),
    day: numberedPart(parts, "day"),
    hour: numberedPart(parts, "hour"),
    minute: numberedPart(parts, "minute"),
    weekday,
  }
}

function dateKey(local: LocalDateTime, daysBefore: number): string {
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day - daysBefore))
  const year = date.getUTCFullYear().toString().padStart(4, "0")
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0")
  const day = date.getUTCDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

function digestPeriodKey(mode: Extract<RouteMode, { readonly type: "digest" }>, at: Date): string {
  const fields = mode.cron.trim().split(/\s+/u)
  const minute = Number(fields[0])
  const hour = Number(fields[1])
  const dayOfMonth = fields[2]
  const month = fields[3]
  const dayOfWeek = fields[4]
  if (
    fields.length !== 5 ||
    !Number.isInteger(minute) ||
    !Number.isInteger(hour) ||
    minute < 0 ||
    minute > 59 ||
    hour < 0 ||
    hour > 23 ||
    dayOfMonth !== "*" ||
    month !== "*"
  ) {
    throw new UnsupportedDigestCron(mode.cron)
  }
  const local = localDateTime(at, mode.timezone)
  const beforeBoundary = local.hour < hour || (local.hour === hour && local.minute < minute)
  if (dayOfWeek === "*") return `daily:${dateKey(local, beforeBoundary ? 1 : 0)}`

  const targetDay = Number(dayOfWeek)
  if (!Number.isInteger(targetDay) || targetDay < 0 || targetDay > 6) {
    throw new UnsupportedDigestCron(mode.cron)
  }
  let daysBefore = (local.weekday - targetDay + 7) % 7
  if (daysBefore === 0 && beforeBoundary) daysBefore = 7
  return `weekly:${dateKey(local, daysBefore)}`
}

function skipReason(
  submission: RoutingSubmission,
  form: RoutingForm,
  route: RoutingRoute,
): DeliveryPlan["skipReason"] {
  if (form.status === "paused") return "paused"
  const at = submission.receivedAt.getTime()
  if (
    (route.window?.from !== undefined &&
      route.window.from !== null &&
      at < route.window.from.getTime()) ||
    (route.window?.until !== undefined &&
      route.window.until !== null &&
      at >= route.window.until.getTime())
  ) {
    return "window"
  }
  const excludesSpam = route.quality?.excludeSpam ?? true
  const excludesQuarantined = route.quality?.excludeQuarantined ?? true
  if (
    (submission.status === "spam" && excludesSpam) ||
    (submission.status === "quarantined" && excludesQuarantined)
  ) {
    return "quality"
  }
  return undefined
}

type PlanRouteInput = {
  readonly submission: RoutingSubmission
  readonly form: RoutingForm
  readonly route: RoutingRoute
  readonly streamId: string | null
  readonly schemaVersion: number | null
}

function planRoute(input: PlanRouteInput): DeliveryPlan {
  const { submission, form, route, streamId, schemaVersion } = input
  const reason = skipReason(submission, form, route)
  const base = {
    routeId: route.id,
    destinationId: route.destinationId,
    streamId,
    schemaVersion,
  }
  if (reason !== undefined) return { ...base, status: "skipped", skipReason: reason }
  if (route.mode?.type === "digest") {
    return {
      ...base,
      status: "pending",
      digestPeriodKey: digestPeriodKey(route.mode, submission.receivedAt),
    }
  }
  return { ...base, status: "pending" }
}

export function planDeliveries(input: PlanDeliveriesInput): readonly DeliveryPlan[] {
  const plans: DeliveryPlan[] = []
  const plannedRouteIds = new Set<string>()
  const candidates = [
    ...input.directRoutes.map((route) => ({
      route,
      streamId: null,
      schemaVersion: input.form.schemaVersion,
    })),
    ...input.streamMemberships.flatMap((membership) =>
      membership.routes.map((route) => ({
        route,
        streamId: membership.streamId,
        schemaVersion: membership.schemaVersion,
      })),
    ),
  ]
  for (const candidate of candidates) {
    if (!candidate.route.enabled || plannedRouteIds.has(candidate.route.id)) continue
    plans.push(
      planRoute({
        submission: input.submission,
        form: input.form,
        route: candidate.route,
        streamId: candidate.streamId,
        schemaVersion: candidate.schemaVersion,
      }),
    )
    plannedRouteIds.add(candidate.route.id)
  }
  return plans
}
