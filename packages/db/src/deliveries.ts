import { sql } from "drizzle-orm"

import type { Database } from "./client.js"

export type ClaimDeliveriesOptions = { readonly limit: number; readonly workerId: string }
export type ClaimedDelivery = {
  readonly id: string
  readonly organizationId: string
  readonly submissionId: string
  readonly routeId: string
  readonly destinationId: string
  readonly payload: unknown
  readonly attempts: number
  readonly schemaVersion: number | null
}

export async function claimDeliveries(
  db: Database,
  options: ClaimDeliveriesOptions,
): Promise<readonly ClaimedDelivery[]> {
  const limit = Math.max(1, Math.min(500, Math.floor(options.limit)))
  return db.transaction(async (transaction) => {
    const result = await transaction.execute<ClaimedDelivery>(sql`
      with candidates as (
        select id
        from deliveries
        where status in ('pending', 'failed')
          and next_attempt_at <= now()
        order by next_attempt_at, created_at
        for update skip locked
        limit ${limit}
      )
      update deliveries as delivery
      set status = 'sending',
          worker_id = ${options.workerId},
          claimed_at = now(),
          attempts = delivery.attempts + 1
      from candidates
      where delivery.id = candidates.id
      returning delivery.id,
                delivery.organization_id as "organizationId",
                delivery.submission_id as "submissionId",
                delivery.route_id as "routeId",
                delivery.destination_id as "destinationId",
                delivery.payload,
                delivery.attempts,
                delivery.schema_version as "schemaVersion"
    `)
    return result
  })
}
