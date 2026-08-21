import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Job D 1d: these test files share one Postgres instance and the worker claims
    // `deliveries` globally (not scoped to an org). Running files in parallel lets one
    // file's in-flight rows race another file's worker loop; run them one at a time so
    // each file's beforeAll/afterAll cleanup is complete before the next file starts.
    fileParallelism: false,
  },
})
