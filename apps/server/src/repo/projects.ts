import { newId } from "@postbag/core"
import { and, eq } from "drizzle-orm"
import { projects, type Database } from "@postbag/db"

export type ProjectRow = typeof projects.$inferSelect

export async function getProjectById(
  db: Database,
  organizationId: string,
  projectId: string,
): Promise<ProjectRow | null> {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
    .limit(1)
  return row ?? null
}

export async function getProjectBySlug(
  db: Database,
  organizationId: string,
  slug: string,
): Promise<ProjectRow | null> {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.organizationId, organizationId), eq(projects.slug, slug)))
    .limit(1)
  return row ?? null
}

/** Resolve a `project` field that may be a `prj_…` id or a slug; defaults to `default`. */
export async function resolveProjectRef(
  db: Database,
  organizationId: string,
  ref: string | undefined,
): Promise<ProjectRow | null> {
  const value = ref ?? "default"
  if (value.startsWith("prj_")) return getProjectById(db, organizationId, value)
  return getProjectBySlug(db, organizationId, value)
}

export async function ensureDefaultProject(db: Database, organizationId: string): Promise<ProjectRow> {
  const existing = await getProjectBySlug(db, organizationId, "default")
  if (existing !== null) return existing
  const [created] = await db
    .insert(projects)
    .values({ id: newId("prj"), organizationId, slug: "default", name: "Default", tags: [] })
    .returning()
  if (created === undefined) throw new Error("Failed to create default project.")
  return created
}
