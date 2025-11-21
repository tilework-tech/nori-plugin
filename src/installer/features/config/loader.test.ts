/**
 * Tests for config loader
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { getConfigPath } from "@/installer/config.js";

import type { Config } from "@/installer/config.js";

import { configLoader } from "./loader.js";

describe("configLoader", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-loader-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("run", () => {
    it("should create config file", async () => {
      const config: Config = {
        installType: "free",
        installDir: tempDir,
        profile: { baseProfile: "senior-swe" },
      };

      await configLoader.run({ config });

      const configFile = getConfigPath({ installDir: tempDir });
      expect(fs.existsSync(configFile)).toBe(true);

      // Verify file contents
      const fileContents = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      expect(fileContents.installDir).toBe(tempDir);
      expect(fileContents.profile).toEqual({ baseProfile: "senior-swe" });
    });
  });

  describe("uninstall", () => {
    it("should remove config file", async () => {
      const config: Config = { installType: "free", installDir: tempDir };
      const configFile = getConfigPath({ installDir: tempDir });

      // Create config file
      fs.writeFileSync(configFile, JSON.stringify({ test: "data" }), "utf-8");

      await configLoader.uninstall({ config });

      expect(fs.existsSync(configFile)).toBe(false);
    });

    it("should handle missing config file gracefully", async () => {
      const config: Config = { installType: "free", installDir: tempDir };

      // Should not throw
      await expect(configLoader.uninstall({ config })).resolves.not.toThrow();
    });
  });
});
