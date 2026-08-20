import { createDb } from "@postbag/db"

import { createAuth } from "./auth.js"

const databaseUrl =
  process.env["DATABASE_URL"] ?? "postgres://postbag:postbag@localhost:5433/postbag"
const baseURL = process.env["APP_URL"] ?? "http://localhost:3000"
const secret = process.env["BETTER_AUTH_SECRET"] ?? "schema-generation-only-secret-32-characters"
const client = createDb(databaseUrl)

export const auth = createAuth({ db: client.db, secret, baseURL, trustedOrigins: [baseURL] })
