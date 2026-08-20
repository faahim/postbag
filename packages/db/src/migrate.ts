import { fileURLToPath } from "node:url"

import { migrate as runMigrations } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"

export async function migrate(url: string): Promise<void> {
  const sql = postgres(url, { max: 1, connect_timeout: 10 })
  try {
    const db = drizzle(sql)
    const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url))
    await runMigrations(db, { migrationsFolder })
  } finally {
    await sql.end({ timeout: 5 })
  }
}
