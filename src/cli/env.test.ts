/**
 * Tests for environment constants
 */

import * as path from "path";

import { describe, it, expect } from "vitest";

import { CLI_ROOT } from "./env.js";

describe("CLI_ROOT", () => {
  it("should be an absolute path", () => {
    expect(path.isAbsolute(CLI_ROOT)).toBe(true);
  });

  it("should point to the package root directory", () => {
    // CLI_ROOT should be the directory containing package.json
    // It should be 3 levels up from src/cli/env.ts -> ../../.. -> root
    expect(CLI_ROOT).toContain("nori-profiles");
  });

  it("should not contain src directory", () => {
    // The root should not end with src or any subdirectory
    expect(CLI_ROOT.endsWith("/src")).toBe(false);
    expect(CLI_ROOT.endsWith("/cli")).toBe(false);
  });
});
