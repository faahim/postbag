import { newId } from "@postbag/core"
import { member, organization, organizationSettings, projects, type Database } from "@postbag/db"

export type SignupUser = { readonly id: string; readonly name: string; readonly email: string }

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
  return base.length === 0 ? "workspace" : base.slice(0, 40)
}

/**
 * Better Auth `databaseHooks.user.create.after`: give every new user a personal
 * organization, ownership, default settings and a "Default" project — Principle 2's
 * "the user never picks a mode" applies to signup too.
 */
export async function provisionPersonalOrganization(db: Database, user: SignupUser): Promise<void> {
  const organizationId = newId("org")
  const base = slugify(user.email.split("@")[0] ?? user.name)
  const slug = `${base}-${organizationId.slice(-6)}`
  const name = user.name.trim().length > 0 ? `${user.name}'s Organization` : "My Organization"

  await db.transaction(async (tx) => {
    await tx.insert(organization).values({ id: organizationId, name, slug, createdAt: new Date() })
    await tx.insert(member).values({
      id: globalThis.crypto.randomUUID(),
      organizationId,
      userId: user.id,
      role: "owner",
      createdAt: new Date(),
    })
    await tx.insert(organizationSettings).values({
      organizationId,
      plan: "free",
      timezone: "UTC",
      limits: {},
    })
    await tx.insert(projects).values({
      id: newId("prj"),
      organizationId,
      slug: "default",
      name: "Default",
      tags: [],
    })
  })
}
