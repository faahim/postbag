import { describe, expect, it } from "vitest"

import { UnsupportedDigestCron } from "./errors.js"
import { planDeliveries } from "./routing.js"

const submission = {
  id: "sb_23456789abcd",
  status: "received" as const,
  receivedAt: new Date("2026-08-21T07:00:00.000Z"),
}

describe("planDeliveries", () => {
  it("skips paused, windowed, and low-quality deliveries while omitting disabled routes", () => {
    const result = planDeliveries({
      submission: { ...submission, status: "spam" },
      form: { status: "paused", schemaVersion: 2 },
      directRoutes: [
        { id: "rt_disabled", destinationId: "ds_a", enabled: false },
        { id: "rt_enabled", destinationId: "ds_b", enabled: true },
      ],
      streamMemberships: [],
    })

    expect(result).toEqual([
      {
        routeId: "rt_enabled",
        destinationId: "ds_b",
        streamId: null,
        status: "skipped",
        skipReason: "paused",
        schemaVersion: 2,
      },
    ])
  })

  it("tags daily and weekly digest periods in the route timezone", () => {
    const result = planDeliveries({
      submission,
      form: { status: "active", schemaVersion: null },
      directRoutes: [
        {
          id: "rt_daily",
          destinationId: "ds_a",
          enabled: true,
          mode: { type: "digest", cron: "0 9 * * *", timezone: "Europe/Stockholm" },
        },
        {
          id: "rt_weekly",
          destinationId: "ds_b",
          enabled: true,
          mode: { type: "digest", cron: "0 9 * * 1", timezone: "Europe/Stockholm" },
        },
      ],
      streamMemberships: [],
    })

    expect(result.map((delivery) => delivery.digestPeriodKey)).toEqual([
      "daily:2026-08-21",
      "weekly:2026-08-17",
    ])
  })

  it("plans routes attached through a stream with its schema version", () => {
    const result = planDeliveries({
      submission,
      form: { status: "active", schemaVersion: 1 },
      directRoutes: [],
      streamMemberships: [
        {
          streamId: "st_a",
          schemaVersion: 4,
          routes: [{ id: "rt_stream", destinationId: "ds_a", enabled: true }],
        },
      ],
    })

    expect(result[0]).toMatchObject({ streamId: "st_a", schemaVersion: 4, status: "pending" })
  })

  it("applies window and quality exclusions independently", () => {
    const result = planDeliveries({
      submission: { ...submission, status: "quarantined" },
      form: { status: "active", schemaVersion: 1 },
      directRoutes: [
        {
          id: "rt_window",
          destinationId: "ds_a",
          enabled: true,
          window: { from: new Date("2026-08-21T08:00:00.000Z") },
        },
        {
          id: "rt_quality",
          destinationId: "ds_b",
          enabled: true,
          quality: { excludeQuarantined: true },
        },
        {
          id: "rt_allowed",
          destinationId: "ds_c",
          enabled: true,
          quality: { excludeQuarantined: false },
        },
      ],
      streamMemberships: [],
    })

    expect(result.map(({ status, skipReason }) => ({ status, skipReason }))).toEqual([
      { status: "skipped", skipReason: "window" },
      { status: "skipped", skipReason: "quality" },
      { status: "pending", skipReason: undefined },
    ])
  })

  it("rejects unsupported digest cron and de-duplicates a route across memberships", () => {
    expect(() =>
      planDeliveries({
        submission,
        form: { status: "active", schemaVersion: 1 },
        directRoutes: [
          {
            id: "rt_bad",
            destinationId: "ds_a",
            enabled: true,
            mode: { type: "digest", cron: "*/5 * * * *", timezone: "UTC" },
          },
        ],
        streamMemberships: [],
      }),
    ).toThrow(UnsupportedDigestCron)

    const repeated = { id: "rt_once", destinationId: "ds_a", enabled: true }
    const result = planDeliveries({
      submission,
      form: { status: "active", schemaVersion: 1 },
      directRoutes: [repeated],
      streamMemberships: [{ streamId: "st_a", schemaVersion: 2, routes: [repeated] }],
    })
    expect(result).toHaveLength(1)
  })
})
