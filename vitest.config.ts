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
    // Disable file parallelism to prevent race conditions between:
    // - build.test.ts which rebuilds the build/ directory
    // - commit-author.test.ts which depends on build artifacts
    // Tests within each file can still run in parallel
    fileParallelism: false,
    testTimeout: 10000, // 10s timeout for slow integration tests
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    reporters: ["dot"],
    silent: true,
    exclude: ["node_modules", "dist", "build", ".worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
