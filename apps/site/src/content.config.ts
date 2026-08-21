import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().default(100),
    section: z.enum(["Start", "Reference", "Guides", "Operate"]).default("Guides"),
    published: z.string().default("2026-08-21"),
    modified: z.string().default("2026-08-21"),
  }),
})

export const collections = { docs }
