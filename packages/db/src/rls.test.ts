import { newId } from "@postbag/core"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createDb, type DatabaseClient } from "./index.js"

const databaseUrl = process.env["DATABASE_URL"]
const integration = describe.skipIf(databaseUrl === undefined)

// Job D §5 "Postgres RLS as the second fence" (migration 0003_rls_second_fence.sql).
// `postbag_app` is a non-owner, non-BYPASSRLS role; `SET LOCAL ROLE postbag_app` inside a
// transaction drops the session into it for that transaction only (plain `SET ROLE` would
// leak into the next borrower of a pooled connection — `LOCAL` is what makes this safe to
// do on a shared pool). `set_config('app.org_id', …, true)` is the parameterized equivalent
// of `SET LOCAL app.org_id = …` — `SET` itself does not accept bind parameters. The app's
// normal (owner) connection never assumes this role — RLS is enforced only for a session
// that opts in, which is exactly how the submit path and the worker (both of which must
// see across every org) stay unaffected while it's off by default.
integration("Postgres RLS second fence (RLS_ENFORCED)", () => {
  let client: DatabaseClient | undefined
  const orgAId = newId("org")
  const orgBId = newId("org")
  const projectAId = newId("prj")
  const projectBId = newId("prj")

  function activeClient(): DatabaseClient {
    if (client === undefined) throw new TypeError("DATABASE_URL integration client is unavailable")
    return client
  }

  beforeAll(async () => {
    if (databaseUrl === undefined) return
    client = createDb(databaseUrl)
    const { sql } = client
    await sql`insert into organization (id, name, slug) values (${orgAId}, 'RLS A', ${orgAId})`
    await sql`insert into organization (id, name, slug) values (${orgBId}, 'RLS B', ${orgBId})`
    await sql`insert into projects (id, organization_id, slug, name) values (${projectAId}, ${orgAId}, 'default', 'Default')`
    await sql`insert into projects (id, organization_id, slug, name) values (${projectBId}, ${orgBId}, 'default', 'Default')`
  })

  afterAll(async () => {
    if (databaseUrl === undefined || client === undefined) return
    await client.sql`delete from organization where id in (${orgAId}, ${orgBId})`
    await client.close()
  })

  it("the owner role (no SET ROLE) bypasses RLS and sees every org", async () => {
    const { sql } = activeClient()
    const rows = await sql<{ id: string }[]>`select id from projects where id in (${projectAId}, ${projectBId})`
    expect(rows.map((row) => row.id).sort()).toEqual([projectAId, projectBId].sort())
  })

  it("postbag_app with app.org_id set to org A sees only org A's rows", async () => {
    const { sql } = activeClient()
    const rows = await sql.begin(async (tx) => {
      await tx`set local role postbag_app`
      await tx`select set_config('app.org_id', ${orgAId}, true)`
      return tx<{ id: string; organization_id: string }[]>`select id, organization_id from projects order by id`
    })
    expect(rows).toEqual([{ id: projectAId, organization_id: orgAId }])
  })

  it("postbag_app with app.org_id set to org B sees only org B's rows", async () => {
    const { sql } = activeClient()
    const rows = await sql.begin(async (tx) => {
      await tx`set local role postbag_app`
      await tx`select set_config('app.org_id', ${orgBId}, true)`
      return tx<{ id: string; organization_id: string }[]>`select id, organization_id from projects order by id`
    })
    expect(rows).toEqual([{ id: projectBId, organization_id: orgBId }])
  })

  it("postbag_app with app.org_id unset sees nothing (default deny)", async () => {
    const { sql } = activeClient()
    const rows = await sql.begin(async (tx) => {
      await tx`set local role postbag_app`
      return tx<{ id: string }[]>`select id from projects`
    })
    expect(rows).toEqual([])
  })

  it("postbag_app with app.org_id set to an unrelated org sees nothing", async () => {
    const { sql } = activeClient()
    const rows = await sql.begin(async (tx) => {
      await tx`set local role postbag_app`
      await tx`select set_config('app.org_id', ${newId("org")}, true)`
      return tx<{ id: string }[]>`select id from projects`
    })
    expect(rows).toEqual([])
  })

  it("postbag_app cannot INSERT a row for an org.id other than app.org_id", async () => {
    const { sql } = activeClient()
    await expect(
      sql.begin(async (tx) => {
        await tx`set local role postbag_app`
        await tx`select set_config('app.org_id', ${orgAId}, true)`
        await tx`insert into projects (id, organization_id, slug, name) values (${newId("prj")}, ${orgBId}, 'sneaky', 'Sneaky')`
      }),
    ).rejects.toThrow()
  })
})
