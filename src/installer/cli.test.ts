import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { processCli } from "./cli.js";

// Mock all the imported modules
vi.mock("@/installer/install.js", () => ({
  main: vi.fn(),
}));

vi.mock("@/installer/uninstall.js", () => ({
  main: vi.fn(),
}));

vi.mock("@/installer/profiles.js", () => ({
  switchProfile: vi.fn(),
}));

vi.mock("@/api/index.js", () => ({
  handshake: vi.fn(),
}));

vi.mock("@/installer/config.js", () => ({
  loadDiskConfig: vi.fn(),
  generateConfig: vi.fn(),
  validateDiskConfig: vi.fn(),
}));

vi.mock("@/installer/features/loaderRegistry.js", () => ({
  LoaderRegistry: {
    getInstance: vi.fn(() => ({
      getAll: vi.fn(() => []),
    })),
  },
}));

/**
 * CLI Argument Parsing Tests
 *
 * Tests the behavior of the CLI when handling help flags and invalid arguments.
 */

describe("CLI help flag handling", () => {
  let consoleLogSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    vi.resetModules();

    // Spy on console.log to capture output
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {
      // Mock implementation - suppress console output in tests
    });
    // Spy on process.exit to prevent actual exit but stop execution
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe("help flag with install command", () => {
    it("should show help when --help flag appears after install command", async () => {
      // This test verifies that `nori-ai install --help` shows help
      // instead of starting the installation process

      await processCli(["install", "--help"]);

      // Verify install-specific help was shown
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Usage: nori-ai install [options]",
      );

      // Verify installMain was NOT called
      const { main: installMain } = await import("@/installer/install.js");
      expect(installMain).not.toHaveBeenCalled();
    });

    it("should show help when -h flag appears after install command", async () => {
      // This test verifies that `nori-ai install -h` shows help

      await processCli(["install", "-h"]);

      // Verify install-specific help was shown
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Usage: nori-ai install [options]",
      );

      // Verify installMain was NOT called
      const { main: installMain } = await import("@/installer/install.js");
      expect(installMain).not.toHaveBeenCalled();
    });
  });

  describe("command-specific help messages", () => {
    it("should show install-specific help for 'install --help'", async () => {
      // This test verifies that help for install shows install-specific options

      await processCli(["install", "--help"]);

      // Verify install-specific help sections are shown
      const output = consoleLogSpy.mock.calls
        .map((call: any) => call[0])
        .join("\n");
      expect(output).toContain("install");
      expect(output).toContain("--install-dir");
      expect(output).toContain("--non-interactive");
    });

    it("should show uninstall-specific help for 'uninstall --help'", async () => {
      // This test verifies that help for uninstall shows uninstall-specific options

      await processCli(["uninstall", "--help"]);

      // Verify uninstall-specific help is shown
      const output = consoleLogSpy.mock.calls
        .map((call: any) => call[0])
        .join("\n");
      expect(output).toContain("uninstall");
    });

    it("should show check-specific help for 'check --help'", async () => {
      // This test verifies that help for check shows check-specific options

      await processCli(["check", "--help"]);

      // Verify check-specific help is shown
      const output = consoleLogSpy.mock.calls
        .map((call: any) => call[0])
        .join("\n");
      expect(output).toContain("check");
    });

    it("should show switch-profile-specific help for 'switch-profile --help'", async () => {
      // This test verifies that help for switch-profile shows usage

      await processCli(["switch-profile", "--help"]);

      // Verify switch-profile help is shown
      const output = consoleLogSpy.mock.calls
        .map((call: any) => call[0])
        .join("\n");
      expect(output).toContain("switch-profile");
    });
  });

  describe("unrecognized arguments", () => {
    it("should show help when install receives invalid arguments", async () => {
      // This test verifies that `nori-ai install lksjdflksjdf` shows help
      // because 'lksjdflksjdf' is not a recognized option

      try {
        await processCli(["install", "lksjdflksjdf"]);
      } catch (err) {
        // Expected to throw because of process.exit
      }

      // Verify install-specific help was shown
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Usage: nori-ai install [options]",
      );

      // Verify installMain was NOT called
      const { main: installMain } = await import("@/installer/install.js");
      expect(installMain).not.toHaveBeenCalled();
    });

    it("should show help when uninstall receives invalid arguments", async () => {
      // This test verifies that `nori-ai uninstall invalid-arg` shows help

      try {
        await processCli(["uninstall", "invalid-arg"]);
      } catch (err) {
        // Expected to throw because of process.exit
      }

      // Verify uninstall-specific help was shown
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Usage: nori-ai uninstall [options]",
      );
    });

    it("should allow valid arguments to pass through", async () => {
      // This test verifies that `nori-ai install --install-dir /path` works
      // and does NOT show help

      await processCli(["install", "--install-dir", "/path"]);

      // Verify help was NOT shown (by checking installMain WAS called)
      const { main: installMain } = await import("@/installer/install.js");
      expect(installMain).toHaveBeenCalled();
    });
  });
});
