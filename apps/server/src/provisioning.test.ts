import { newId } from "@postbag/core"
import { member, organization, type Database } from "@postbag/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { buildHarness, TEST_DATABASE_URL, type TestHarness } from "./testUtils.js"

const integration = describe.skipIf(TEST_DATABASE_URL === undefined)

// Job G 1b: confirm `databaseHooks.user.create.after` (and therefore
// `provisionPersonalOrganization`) fires for users created through social sign-in, not just
// `signUp.email`. Driving the real Google/GitHub OAuth round trip needs a mocked provider
// token exchange, which is heavy and brittle; the spec's named acceptable alternative is to
// drive the Better Auth adapter's user-create path the same way the OAuth callback does.
// Better Auth's own OAuth callback (`handleOAuthUserInfo` in `oauth2/link-account.ts`) calls
// exactly `c.context.internalAdapter.createOAuthUser(userInfo, accountData)` when no local
// user exists yet for that provider account — that is the function under test here, reached
// through the same `auth.$context` the request handler uses, not a re-implementation of it.
integration("provisionPersonalOrganization runs for OAuth-created users too", () => {
  let harness: TestHarness
  let db: Database
  const createdOrgIds: string[] = []

  beforeAll(() => {
    harness = buildHarness()
    db = harness.db
  })

  afterAll(async () => {
    for (const organizationId of createdOrgIds) {
      await db.delete(organization).where(eq(organization.id, organizationId))
    }
    await harness.close()
  })

  it("provisions a personal organization + membership for a user created via internalAdapter.createOAuthUser (the OAuth callback's own user-create path)", async () => {
    const context = await harness.auth.$context
    const email = `${newId("usr")}@example.test`

    const { user, account } = await context.internalAdapter.createOAuthUser(
      { name: "Social Sign-in User", email, emailVerified: true },
      { providerId: "google", accountId: `google-${newId("usr")}` },
    )

    expect(account.providerId).toBe("google")

    const [membership] = await db.select().from(member).where(eq(member.userId, user.id)).limit(1)
    expect(membership).toBeDefined()
    expect(membership?.role).toBe("owner")
    if (membership !== undefined) createdOrgIds.push(membership.organizationId)

    const [org] =
      membership === undefined
        ? []
        : await db.select().from(organization).where(eq(organization.id, membership.organizationId)).limit(1)
    expect(org?.name).toBe("Social Sign-in User's Organization")
  })
})
