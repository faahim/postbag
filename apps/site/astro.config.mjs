import { defineConfig } from "astro/config"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"

// The public site URL. The marketing site is served by the Postbag server container at `/`
// (apps/server/src/routes/staticSite.ts), so by default it shares the API's origin.
const site = process.env.SITE_URL ?? "https://postbag.dev"

export default defineConfig({
  site,
  // Built straight into the server's dist so the one Docker image serves it (ADR-003 spirit).
  outDir: "../server/dist/site",
  trailingSlash: "always",
  build: { format: "directory", inlineStylesheets: "auto" },
  compressHTML: true,
  prefetch: { prefetchAll: true, defaultStrategy: "viewport" },
  integrations: [
    sitemap({
      // Keep the sitemap to the marketing/doc pages; the API lives on the same origin.
      filter: (page) => !page.includes("/404"),
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  markdown: {
    shikiConfig: { themes: { light: "github-light", dark: "github-dark-dimmed" }, wrap: true },
  },
})
