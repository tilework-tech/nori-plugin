import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as pathUtils from "@/utils/path.js";

// ANSI color codes for verification
const GREEN = "\x1b[0;32m";

describe("statistics-notification hook", () => {
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

  it("should output message with ANSI line-clearing codes to stderr", async () => {
    // Import and run the hook (dynamic import to ensure fresh module)
    const { main } = await import("./statistics-notification.js");
    await main();

    // Verify output contains ANSI cursor up and clear codes
    expect(consoleErrorSpy).toHaveBeenCalled();
    const output = consoleErrorSpy.mock.calls[0][0];
    expect(output).toMatch(/^\r\x1b\[\d+A\x1b\[J/); // Carriage return + cursor up + clear to end
    expect(output).toContain(GREEN); // Green colored
    expect(output).toContain("Calculating");
    expect(output).toContain("statistics");
  });

  it("should exit with code 2 to trigger Claude Code's failure display", async () => {
    const { main } = await import("./statistics-notification.js");
    await main();

    // Verify exit code 2 is called
    expect(process.exit).toHaveBeenCalledWith(2);
  });

  it("should exit silently when no installation found (no output, exit 0)", async () => {
    // Mock no installations found
    vi.spyOn(pathUtils, "getInstallDirs").mockReturnValue([]);

    const { main } = await import("./statistics-notification.js");

    // Should not throw, should exit gracefully
    await expect(main()).resolves.not.toThrow();

    // Should not output anything when no installation found (silent failure)
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    // Should NOT exit with code 2 when there's nothing to display
    expect(process.exit).not.toHaveBeenCalledWith(2);
  });
});
