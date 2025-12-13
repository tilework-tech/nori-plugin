/**
 * Tests for environment constants
 */

import * as fs from "fs";
import * as path from "path";

import { describe, it, expect } from "vitest";

import { CLI_ROOT } from "./env.js";

describe("CLI_ROOT", () => {
  it("should be an absolute path", () => {
    expect(path.isAbsolute(CLI_ROOT)).toBe(true);
  });

  it("should contain package.json", () => {
    // CLI_ROOT should be the directory containing package.json
    const packageJsonPath = path.join(CLI_ROOT, "package.json");
    expect(fs.existsSync(packageJsonPath)).toBe(true);
  });

  it("should contain package.json with name nori-ai", () => {
    // Verify we found the correct package.json (not a parent directory's)
    const packageJsonPath = path.join(CLI_ROOT, "package.json");
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    expect(pkg.name).toBe("nori-ai");
  });

  it("should not end with src or cli directory", () => {
    // The root should not end with src or any subdirectory
    expect(CLI_ROOT.endsWith("/src")).toBe(false);
    expect(CLI_ROOT.endsWith("/cli")).toBe(false);
  });
});
