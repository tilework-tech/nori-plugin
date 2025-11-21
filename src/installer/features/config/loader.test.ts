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
    it("should not create config file (config is managed by install.ts)", async () => {
      const config: Config = { installType: "free", installDir: tempDir };

      await configLoader.run({ config });

      const configFile = getConfigPath({ installDir: tempDir });
      // The loader doesn't create the file - that's handled by install.ts
      expect(fs.existsSync(configFile)).toBe(false);
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
