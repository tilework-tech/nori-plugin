import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { loadConfig } from "@/cli/config.js";
import * as pathUtils from "@/utils/path.js";

// Mock the config module
vi.mock("@/cli/config.js", () => ({
  loadConfig: vi.fn(),
}));

// ANSI color codes for verification
const GREEN = "\x1b[0;32m";
const RED = "\x1b[0;31m";

describe("summarize-notification hook", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // Mock implementation
    });

    vi.spyOn(process, "exit").mockImplementation((() => {
      // Mock implementation - don't actually exit
    }) as () => never);

    // Mock getInstallDirs to return a valid installation directory
    vi.spyOn(pathUtils, "getInstallDirs").mockReturnValue([process.cwd()]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should output message with ANSI line-clearing codes when sendSessionTranscript is enabled", async () => {
    // Mock config with enabled transcripts
    vi.mocked(loadConfig).mockResolvedValue({
      sendSessionTranscript: "enabled",
      installDir: process.cwd(),
    });

    // Import and run the hook (dynamic import to ensure fresh module)
    const { main } = await import("./summarize-notification.js");
    await main();

    // Verify output contains ANSI cursor up and clear codes
    expect(consoleErrorSpy).toHaveBeenCalled();
    const output = consoleErrorSpy.mock.calls[0][0];
    expect(output).toMatch(/^\x1b\[\d+A\x1b\[J/); // Cursor up + clear to end
    expect(output).toContain(GREEN); // Green colored
    expect(output).toContain("Saving");
    expect(output).toContain("transcript");
  });

  it("should exit with code 2 to trigger Claude Code's failure display", async () => {
    // Mock config with enabled transcripts
    vi.mocked(loadConfig).mockResolvedValue({
      sendSessionTranscript: "enabled",
      installDir: process.cwd(),
    });

    const { main } = await import("./summarize-notification.js");
    await main();

    // Verify exit code 2 is called
    expect(process.exit).toHaveBeenCalledWith(2);
  });

  it("should output disabled message with ANSI line-clearing when sendSessionTranscript is disabled", async () => {
    // Mock config with disabled transcripts
    vi.mocked(loadConfig).mockResolvedValue({
      sendSessionTranscript: "disabled",
      installDir: process.cwd(),
    });

    const { main } = await import("./summarize-notification.js");
    await main();

    // Verify output contains ANSI codes and disabled message
    expect(consoleErrorSpy).toHaveBeenCalled();
    const output = consoleErrorSpy.mock.calls[0][0];
    expect(output).toMatch(/^\x1b\[\d+A\x1b\[J/);
    expect(output).toContain(GREEN);
    expect(output).toContain("disabled");
  });

  it("should default to enabled behavior when config is missing sendSessionTranscript", async () => {
    // Mock config with no sendSessionTranscript field (backward compatibility)
    vi.mocked(loadConfig).mockResolvedValue({
      installDir: process.cwd(),
    });

    const { main } = await import("./summarize-notification.js");
    await main();

    // Verify output defaults to enabled message
    expect(consoleErrorSpy).toHaveBeenCalled();
    const output = consoleErrorSpy.mock.calls[0][0];
    expect(output).toMatch(/^\x1b\[\d+A\x1b\[J/);
    expect(output).toContain("Saving");
  });

  it("should output red error message with ANSI line-clearing when no installation found", async () => {
    // Mock no installations found
    vi.spyOn(pathUtils, "getInstallDirs").mockReturnValue([]);

    const { main } = await import("./summarize-notification.js");
    await main();

    // Should output red error message with ANSI codes
    expect(consoleErrorSpy).toHaveBeenCalled();
    const output = consoleErrorSpy.mock.calls[0][0];
    expect(output).toMatch(/^\x1b\[\d+A\x1b\[J/);
    expect(output).toContain(RED);
    expect(output).toContain("Error");
  });

  it("should output red error message with ANSI line-clearing when config loading fails", async () => {
    // Mock config loading failure
    vi.mocked(loadConfig).mockRejectedValue(new Error("Config load failed"));

    const { main } = await import("./summarize-notification.js");
    await main();

    // Should output red error message with ANSI codes
    expect(consoleErrorSpy).toHaveBeenCalled();
    const output = consoleErrorSpy.mock.calls[0][0];
    expect(output).toMatch(/^\x1b\[\d+A\x1b\[J/);
    expect(output).toContain(RED);
  });
});
