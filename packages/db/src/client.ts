import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres, { type Sql } from "postgres"

import * as schema from "./schema/index.js"

export type Database = PostgresJsDatabase<typeof schema> & { readonly $client: Sql }
export type DatabaseClient = {
  readonly db: Database
  readonly sql: Sql
  readonly close: () => Promise<void>
}

export function createDb(url: string): DatabaseClient {
  const sql = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 30 * 60,
  })
  return {
    db: drizzle(sql, { schema }),
    sql,
    close: () => sql.end({ timeout: 5 }),
  }
}
