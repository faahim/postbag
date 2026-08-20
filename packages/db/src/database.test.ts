import { newId } from "@postbag/core"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { claimDeliveries, createDb, type DatabaseClient } from "./index.js"

const databaseUrl = process.env["DATABASE_URL"]
const integration = describe.skipIf(databaseUrl === undefined)

integration("database integration (set DATABASE_URL to run)", () => {
  let client: DatabaseClient | undefined
  const organizationId = newId("org")
  const userId = newId("usr")
  const projectId = newId("prj")
  const formId = newId("fm")
  const destinationId = newId("ds")
  const routeId = newId("rt")

  function activeClient(): DatabaseClient {
    if (client === undefined) throw new TypeError("DATABASE_URL integration client is unavailable")
    return client
  }

  beforeAll(async () => {
    if (databaseUrl === undefined) return
    client = createDb(databaseUrl)
    await client.sql`insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'DB Test', ${`${userId}@example.test`}, true, now(), now())`
    await client.sql`insert into organization (id, name, slug, created_at)
      values (${organizationId}, 'DB Test', ${organizationId}, now())`
    await client.sql`insert into projects (id, organization_id, slug, name, tags)
      values (${projectId}, ${organizationId}, 'default', 'Default', '{}')`
    await client.sql`insert into forms (id, organization_id, project_id, slug, name)
      values (${formId}, ${organizationId}, ${projectId}, 'contact', 'Contact')`
    await client.sql`insert into destinations (id, organization_id, type, name, config, verified)
      values (${destinationId}, ${organizationId}, 'webhook', 'Test', '{}', true)`
    await client.sql`insert into routes (id, organization_id, form_id, destination_id)
      values (${routeId}, ${organizationId}, ${formId}, ${destinationId})`
  })

  afterAll(async () => {
    if (databaseUrl === undefined || client === undefined) return
    await client.sql`delete from organization where id = ${organizationId}`
    await client.sql`delete from "user" where id = ${userId}`
    await client.close()
  })

  it("has every table from the committed migration", async () => {
    const { sql } = activeClient()
    const rows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_name in ('forms', 'submissions', 'deliveries', 'apikey')
    `

    expect(rows.map((row) => row.table_name).sort()).toEqual([
      "apikey",
      "deliveries",
      "forms",
      "submissions",
    ])
  })

  it("rejects duplicate form idempotency keys", async () => {
    const { sql } = activeClient()
    const key = newId("key")
    await sql`insert into submissions (id, organization_id, form_id, data, idempotency_key)
      values (${newId("sb")}, ${organizationId}, ${formId}, '{}', ${key})`

    await expect(
      sql`insert into submissions (id, organization_id, form_id, data, idempotency_key)
        values (${newId("sb")}, ${organizationId}, ${formId}, '{}', ${key})`,
    ).rejects.toMatchObject({ code: "23505" })
  })

  it("rejects duplicate form and stream schema versions", async () => {
    const { sql } = activeClient()
    const streamId = newId("st")
    const formSchemaId = newId("fs")
    const streamSchemaId = newId("ss")
    await sql`insert into streams (id, organization_id, slug, name)
      values (${streamId}, ${organizationId}, ${streamId}, 'Test Stream')`
    await sql`insert into form_schemas (id, organization_id, form_id, version, json_schema)
      values (${formSchemaId}, ${organizationId}, ${formId}, 1, '{}')`
    await sql`insert into stream_schemas (id, organization_id, stream_id, version, json_schema)
      values (${streamSchemaId}, ${organizationId}, ${streamId}, 1, '{}')`

    await expect(
      sql`insert into form_schemas (id, organization_id, form_id, version, json_schema)
        values (${newId("fs")}, ${organizationId}, ${formId}, 1, '{}')`,
    ).rejects.toMatchObject({ code: "23505" })
    await expect(
      sql`insert into stream_schemas (id, organization_id, stream_id, version, json_schema)
        values (${newId("ss")}, ${organizationId}, ${streamId}, 1, '{}')`,
    ).rejects.toMatchObject({ code: "23505" })
    await expect(
      sql`update form_schemas set changelog = 'mutated' where id = ${formSchemaId}`,
    ).rejects.toMatchObject({ code: "55000" })
    await expect(
      sql`update stream_schemas set changelog = 'mutated' where id = ${streamSchemaId}`,
    ).rejects.toMatchObject({ code: "55000" })
  })

  it("rejects duplicate delivery and digest identities", async () => {
    const { sql } = activeClient()
    const submissionId = newId("sb")
    await sql`insert into submissions (id, organization_id, form_id, data)
      values (${submissionId}, ${organizationId}, ${formId}, '{}')`
    await sql`insert into deliveries
      (id, organization_id, submission_id, route_id, destination_id, status, payload, dedupe_key)
      values (${newId("dl")}, ${organizationId}, ${submissionId}, ${routeId}, ${destinationId}, 'sent', '{}', ${newId("key")})`
    await sql`insert into digests (id, organization_id, route_id, period_key)
      values (${newId("dg")}, ${organizationId}, ${routeId}, 'daily:2026-08-21')`

    await expect(
      sql`insert into deliveries
        (id, organization_id, submission_id, route_id, destination_id, status, payload, dedupe_key)
        values (${newId("dl")}, ${organizationId}, ${submissionId}, ${routeId}, ${destinationId}, 'sent', '{}', ${newId("key")})`,
    ).rejects.toMatchObject({ code: "23505" })
    await expect(
      sql`insert into digests (id, organization_id, route_id, period_key)
        values (${newId("dg")}, ${organizationId}, ${routeId}, 'daily:2026-08-21')`,
    ).rejects.toMatchObject({ code: "23505" })
  })

  it("rejects cross-organization tenant references", async () => {
    const { sql } = activeClient()
    const otherOrganizationId = newId("org")
    const otherProjectId = newId("prj")
    await sql`insert into organization (id, name, slug, created_at)
      values (${otherOrganizationId}, 'Other Org', ${otherOrganizationId}, now())`
    await sql`insert into projects (id, organization_id, slug, name, tags)
      values (${otherProjectId}, ${otherOrganizationId}, 'default', 'Default', '{}')`

    await expect(
      sql`insert into forms (id, organization_id, project_id, slug, name)
        values (${newId("fm")}, ${organizationId}, ${otherProjectId}, 'cross-tenant', 'Forbidden')`,
    ).rejects.toMatchObject({ code: "23503" })

    await sql`delete from organization where id = ${otherOrganizationId}`
  })

  it("does not double-claim across concurrent workers", async () => {
    const database = activeClient()
    const firstSubmission = newId("sb")
    const secondSubmission = newId("sb")
    const firstDelivery = newId("dl")
    const secondDelivery = newId("dl")
    await database.sql`insert into submissions (id, organization_id, form_id, data)
      values (${firstSubmission}, ${organizationId}, ${formId}, '{}'),
             (${secondSubmission}, ${organizationId}, ${formId}, '{}')`
    await database.sql`insert into deliveries
      (id, organization_id, submission_id, route_id, destination_id, payload, dedupe_key, next_attempt_at)
      values (${firstDelivery}, ${organizationId}, ${firstSubmission}, ${routeId}, ${destinationId}, '{}', ${`${firstSubmission}:${routeId}`}, '1970-01-01T00:00:00Z'),
             (${secondDelivery}, ${organizationId}, ${secondSubmission}, ${routeId}, ${destinationId}, '{}', ${`${secondSubmission}:${routeId}`}, '1970-01-01T00:00:00Z')`

    const [first, second] = await Promise.all([
      claimDeliveries(database.db, { limit: 1, workerId: "worker-a" }),
      claimDeliveries(database.db, { limit: 1, workerId: "worker-b" }),
    ])

    expect(new Set([first[0]?.id, second[0]?.id])).toEqual(new Set([firstDelivery, secondDelivery]))
  })
})
