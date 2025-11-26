import { fileURLToPath } from "node:url";
import path from "path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  test: {
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
        execArgv: ["--max-old-space-size=6144"],
      },
    },
    testTimeout: 10000, // 10s timeout for slow integration tests
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    reporters: ["dot"],
    silent: true,
    exclude: ["node_modules", "dist", "build", ".worktrees/**"],
    // Disable parallel test file execution to prevent race conditions.
    // cli.test.ts runs `node build/src/installer/cli.js` as a subprocess to test CLI behavior.
    // build.test.ts runs `npm run build` to verify the build process.
    // If these run in parallel, cli.test.ts can catch cli.js mid-rebuild when tsc has
    // written the file but tsc-alias hasn't resolved @/ imports yet.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
