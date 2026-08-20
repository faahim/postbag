import { sql } from "drizzle-orm"
import postgres from "postgres"

import type { Database } from "./client.js"

const DELIVERY_CHANNEL = "postbag_deliveries"

export async function notifyDeliveries(db: Database): Promise<void> {
  await db.execute(sql`select pg_notify(${DELIVERY_CHANNEL}, '')`)
}

export async function listenDeliveries(
  url: string,
  onWake: () => void | Promise<void>,
): Promise<() => Promise<void>> {
  const connection = postgres(url, { max: 1, connect_timeout: 10, idle_timeout: 0 })
  try {
    await connection.listen(DELIVERY_CHANNEL, () => {
      void Promise.resolve(onWake()).catch(() => undefined)
    })
    return () => connection.end({ timeout: 5 })
  } catch (error) {
    await connection.end({ timeout: 5 })
    throw error
  }
}
