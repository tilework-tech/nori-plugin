/**
 * Tests for Cursor intercepted slash commands registry
 * Verifies that Cursor has its own registry separate from Claude
 */

import { describe, it, expect } from "vitest";

import { cursorInterceptedSlashCommands } from "./registry.js";

describe("cursor intercepted slash commands registry", () => {
  it("should export an array of intercepted commands", () => {
    expect(cursorInterceptedSlashCommands).toBeInstanceOf(Array);
    expect(cursorInterceptedSlashCommands.length).toBeGreaterThan(0);
  });

  it("should include nori-switch-profile command", () => {
    const switchProfile = cursorInterceptedSlashCommands.find((cmd) =>
      cmd.matchers.some((m) => m.includes("nori-switch-profile")),
    );
    expect(switchProfile).toBeDefined();
  });

  it("should include nori-install-location command", () => {
    const installLocation = cursorInterceptedSlashCommands.find((cmd) =>
      cmd.matchers.some((m) => m.includes("nori-install-location")),
    );
    expect(installLocation).toBeDefined();
  });

  it("should include nori-registry-download command", () => {
    const registryDownload = cursorInterceptedSlashCommands.find((cmd) =>
      cmd.matchers.some((m) => m.includes("nori-registry-download")),
    );
    expect(registryDownload).toBeDefined();
  });

  it("should include nori-registry-search command", () => {
    const registrySearch = cursorInterceptedSlashCommands.find((cmd) =>
      cmd.matchers.some((m) => m.includes("nori-registry-search")),
    );
    expect(registrySearch).toBeDefined();
  });

  it("should include nori-registry-upload command", () => {
    const registryUpload = cursorInterceptedSlashCommands.find((cmd) =>
      cmd.matchers.some((m) => m.includes("nori-registry-upload")),
    );
    expect(registryUpload).toBeDefined();
  });

  it("should NOT include nori-toggle-autoupdate command (Claude-only)", () => {
    const toggleAutoupdate = cursorInterceptedSlashCommands.find((cmd) =>
      cmd.matchers.some((m) => m.includes("nori-toggle-autoupdate")),
    );
    expect(toggleAutoupdate).toBeUndefined();
  });

  it("should NOT include nori-toggle-session-transcripts command (Claude-only)", () => {
    const toggleTranscripts = cursorInterceptedSlashCommands.find((cmd) =>
      cmd.matchers.some((m) => m.includes("nori-toggle-session-transcripts")),
    );
    expect(toggleTranscripts).toBeUndefined();
  });

  it("should have all commands with valid matchers", () => {
    for (const command of cursorInterceptedSlashCommands) {
      expect(command.matchers).toBeInstanceOf(Array);
      expect(command.matchers.length).toBeGreaterThan(0);

      for (const matcher of command.matchers) {
        expect(() => new RegExp(matcher)).not.toThrow();
      }
    }
  });

  it("should have all commands with a run function", () => {
    for (const command of cursorInterceptedSlashCommands) {
      expect(typeof command.run).toBe("function");
    }
  });
});
