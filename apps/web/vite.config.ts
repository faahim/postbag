import { fileURLToPath, URL } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const backend = "http://localhost:3000"

// https://vite.dev/config/
export default defineConfig({
  base: "/app/",
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backend, changeOrigin: false },
      "/v1": { target: backend, changeOrigin: false },
      "/s": { target: backend, changeOrigin: false },
    },
  },
  build: {
    // apps/server/src/routes/staticApp.ts resolves its static root as `../public`
    // relative to the *compiled* file (dist/routes/staticApp.js), i.e. apps/server/dist/public.
    // Building here means `pnpm --filter @postbag/server build` sweeps the SPA into dist/
    // for free (dist/ is already gitignored, and `files: ["dist"]` in the server's
    // package.json is what `pnpm deploy` — and the Dockerfile — ship).
    outDir: "../server/dist/public",
    emptyOutDir: true,
    sourcemap: true,
  },
})
