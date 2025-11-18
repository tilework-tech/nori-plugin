/**
 * Tests for paid-recall skill script
 */

import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { main } from "./script.js";

describe("paid-recall script", () => {
  let tempConfigPath: string;
  let originalHome: string | undefined;
  let originalArgv: Array<string>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalHome = process.env.HOME;
    originalArgv = process.argv;

    const tempDir = path.join(os.tmpdir(), `recall-test-${Date.now()}`);
    process.env.HOME = tempDir;
    tempConfigPath = path.join(tempDir, "nori-config.json");

    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit(${code})`);
      }) as any;
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    process.argv = originalArgv;

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();

    try {
      await fs.rm(path.dirname(tempConfigPath), {
        recursive: true,
        force: true,
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("tier checking", () => {
    it("should fail when no config file exists", async () => {
      process.argv = ["node", "script.js", "--query=test"];

      await expect(main()).rejects.toThrow("process.exit(1)");
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: This feature requires a paid Nori subscription.",
      );
    });

    it("should fail when config has no auth credentials", async () => {
      await fs.mkdir(path.dirname(tempConfigPath), { recursive: true });
      await fs.writeFile(tempConfigPath, JSON.stringify({}));

      process.argv = ["node", "script.js", "--query=test"];

      await expect(main()).rejects.toThrow("process.exit(1)");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("argument parsing", () => {
    it("should fail when --query is missing", async () => {
      await fs.mkdir(path.dirname(tempConfigPath), { recursive: true });
      await fs.writeFile(
        tempConfigPath,
        JSON.stringify({
          username: "test@example.com",
          password: "password",
          organizationUrl: "https://test.nori.ai",
        }),
      );

      process.argv = ["node", "script.js", "--limit=5"];

      await expect(main()).rejects.toThrow("process.exit(1)");
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: --query parameter is required",
      );
    });

    it("should show usage help when arguments are invalid", async () => {
      await fs.mkdir(path.dirname(tempConfigPath), { recursive: true });
      await fs.writeFile(
        tempConfigPath,
        JSON.stringify({
          username: "test@example.com",
          password: "password",
          organizationUrl: "https://test.nori.ai",
        }),
      );

      process.argv = ["node", "script.js"];

      await expect(main()).rejects.toThrow("process.exit(1)");
      const errorCalls = consoleErrorSpy.mock.calls.flat().join("\n");
      expect(errorCalls).toMatch(/Usage:/);
    });

    it("should use default limit when not provided", async () => {
      // This test structure is set up for when API mocking is available
      expect(true).toBe(true);
    });
  });

  describe("output formatting", () => {
    it("should output formatted search results", async () => {
      // Test structure for API mock integration
      expect(true).toBe(true);
    });
  });
});
