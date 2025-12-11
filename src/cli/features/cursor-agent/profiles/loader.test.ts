/**
 * Tests for cursor-agent profiles loader
 */

import * as fs from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";

import { describe, test, expect, beforeEach, afterEach } from "vitest";

import { profilesLoader } from "@/cli/features/cursor-agent/profiles/loader.js";

import type { Config } from "@/cli/config.js";

describe("cursor-agent profiles loader", () => {
  let testInstallDir: string;

  beforeEach(async () => {
    testInstallDir = await fs.mkdtemp(
      path.join(tmpdir(), "cursor-profiles-test-"),
    );
  });

  afterEach(async () => {
    if (testInstallDir) {
      await fs.rm(testInstallDir, { recursive: true, force: true });
    }
  });

  const createConfig = (overrides: Partial<Config> = {}): Config => ({
    installDir: testInstallDir,
    profile: { baseProfile: "amol" },
    ...overrides,
  });

  describe("loader metadata", () => {
    test("has correct name", () => {
      expect(profilesLoader.name).toBe("profiles");
    });

    test("has description", () => {
      expect(profilesLoader.description).toBeDefined();
      expect(profilesLoader.description.length).toBeGreaterThan(0);
    });
  });

  describe("run (install)", () => {
    test("creates profiles directory", async () => {
      const config = createConfig();

      await profilesLoader.run({ config });

      const profilesDir = path.join(testInstallDir, ".cursor", "profiles");
      const stat = await fs.stat(profilesDir);
      expect(stat.isDirectory()).toBe(true);
    });

    test("installs amol profile with AGENTS.md", async () => {
      const config = createConfig();

      await profilesLoader.run({ config });

      const agentsMdPath = path.join(
        testInstallDir,
        ".cursor",
        "profiles",
        "amol",
        "AGENTS.md",
      );
      await expect(fs.access(agentsMdPath)).resolves.toBeUndefined();
    });
  });

  describe("uninstall", () => {
    test("removes installed profiles", async () => {
      const config = createConfig();

      // First install
      await profilesLoader.run({ config });

      // Then uninstall
      await profilesLoader.uninstall({ config });

      const profilesDir = path.join(testInstallDir, ".cursor", "profiles");
      await expect(fs.access(profilesDir)).rejects.toThrow();
    });
  });

  describe("validate", () => {
    test("returns valid when profiles are installed", async () => {
      const config = createConfig();

      await profilesLoader.run({ config });

      const result = await profilesLoader.validate!({ config });
      expect(result.valid).toBe(true);
    });

    test("returns invalid when profiles directory missing", async () => {
      const config = createConfig();

      const result = await profilesLoader.validate!({ config });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});
