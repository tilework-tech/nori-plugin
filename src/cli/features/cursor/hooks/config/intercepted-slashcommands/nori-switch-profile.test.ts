/**
 * Tests for Cursor-specific nori-switch-profile intercepted slash command
 * Verifies that Cursor uses ~/.cursor/profiles/ instead of ~/.claude/profiles/
 */

import * as fsSync from "fs";
import * as fs from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock env module before importing the module under test
vi.mock("@/cli/env.js", () => ({
  getCursorProfilesDir: (args: { installDir: string }) =>
    path.join(args.installDir, ".cursor", "profiles"),
  getCursorDir: (args: { installDir: string }) =>
    path.join(args.installDir, ".cursor"),
  getInstallDirs: (args: { currentDir: string }) => {
    // Walk up the directory tree looking for .nori-config.json
    let dir = args.currentDir;
    const installations: Array<string> = [];
    while (dir !== path.dirname(dir)) {
      try {
        const configPath = path.join(dir, ".nori-config.json");
        if (fsSync.existsSync(configPath)) {
          installations.push(dir);
        }
      } catch {
        // Ignore
      }
      dir = path.dirname(dir);
    }
    return installations;
  },
}));

// Import after mocking
import type { HookInput } from "./types.js";

import { cursorNoriSwitchProfile } from "./nori-switch-profile.js";

/**
 * Strip ANSI escape codes from a string for plain text comparison
 *
 * @param str - The string containing ANSI codes
 *
 * @returns The string with ANSI codes removed
 */
const stripAnsi = (str: string): string => {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
};

describe("cursor nori-switch-profile", () => {
  let testDir: string;
  let cursorProfilesDir: string;
  let configPath: string;

  beforeEach(async () => {
    // Create test directory structure with CURSOR paths
    testDir = await fs.mkdtemp(
      path.join(tmpdir(), "cursor-nori-switch-profile-test-"),
    );
    // CRITICAL: Use .cursor directory, not .claude
    const cursorDir = path.join(testDir, ".cursor");
    cursorProfilesDir = path.join(cursorDir, "profiles");
    configPath = path.join(testDir, ".nori-config.json");

    // Create Cursor profiles directory with test profiles
    await fs.mkdir(cursorProfilesDir, { recursive: true });

    // Create test profiles in CURSOR directory
    for (const profileName of ["amol", "senior-swe", "product-manager"]) {
      const profileDir = path.join(cursorProfilesDir, profileName);
      await fs.mkdir(profileDir, { recursive: true });
      await fs.writeFile(
        path.join(profileDir, "CLAUDE.md"),
        `# ${profileName} profile`,
      );
      await fs.writeFile(
        path.join(profileDir, "profile.json"),
        JSON.stringify({
          name: profileName,
          description: `Test ${profileName} profile`,
          builtin: true,
        }),
      );
    }

    // Create initial config with cursorProfile field
    await fs.writeFile(
      configPath,
      JSON.stringify({
        cursorProfile: {
          baseProfile: "senior-swe",
        },
      }),
    );
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  const createInput = (args: {
    prompt: string;
    cwd?: string | null;
  }): HookInput => {
    const { prompt, cwd } = args;
    return {
      prompt,
      cwd: cwd ?? testDir,
      session_id: "test-session",
      transcript_path: "",
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
    };
  };

  describe("matchers", () => {
    it("should have valid regex matchers", () => {
      expect(cursorNoriSwitchProfile.matchers).toBeInstanceOf(Array);
      expect(cursorNoriSwitchProfile.matchers.length).toBeGreaterThan(0);

      for (const matcher of cursorNoriSwitchProfile.matchers) {
        expect(() => new RegExp(matcher)).not.toThrow();
      }
    });
  });

  describe("run function", () => {
    it("should switch cursor profile when profile name provided", async () => {
      const input = createInput({ prompt: "/nori-switch-profile amol" });
      const result = await cursorNoriSwitchProfile.run({ input });

      expect(result).not.toBeNull();
      expect(result!.decision).toBe("block");
      expect(result!.reason).toContain("amol");

      // Verify CURSOR profile was actually switched in config
      const updatedConfig = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(updatedConfig.cursorProfile.baseProfile).toBe("amol");
    });

    it("should list available cursor profiles when no profile name provided", async () => {
      const input = createInput({ prompt: "/nori-switch-profile" });
      const result = await cursorNoriSwitchProfile.run({ input });

      expect(result).not.toBeNull();
      expect(result!.decision).toBe("block");
      const plainReason = stripAnsi(result!.reason!);
      expect(plainReason).toContain("Available profiles:");
      expect(plainReason).toContain("amol");
      expect(plainReason).toContain("senior-swe");
      expect(plainReason).toContain("product-manager");
    });

    it("should use .cursor profiles directory, not .claude", async () => {
      // This test verifies the critical behavior: Cursor uses .cursor/profiles
      // Create a .claude/profiles directory with different profiles to prove
      // we're NOT using it
      const claudeProfilesDir = path.join(testDir, ".claude", "profiles");
      await fs.mkdir(claudeProfilesDir, { recursive: true });
      const claudeOnlyProfile = path.join(claudeProfilesDir, "claude-only");
      await fs.mkdir(claudeOnlyProfile, { recursive: true });
      await fs.writeFile(
        path.join(claudeOnlyProfile, "CLAUDE.md"),
        "# Claude only profile",
      );

      const input = createInput({ prompt: "/nori-switch-profile" });
      const result = await cursorNoriSwitchProfile.run({ input });

      expect(result).not.toBeNull();
      const plainReason = stripAnsi(result!.reason!);
      // Should NOT contain the Claude-only profile
      expect(plainReason).not.toContain("claude-only");
      // Should contain the Cursor profiles
      expect(plainReason).toContain("amol");
    });
  });

  describe("error handling", () => {
    it("should return error for non-existent profile", async () => {
      const input = createInput({ prompt: "/nori-switch-profile nonexistent" });
      const result = await cursorNoriSwitchProfile.run({ input });

      expect(result).not.toBeNull();
      expect(result!.decision).toBe("block");
      const plainReason = stripAnsi(result!.reason!);
      expect(plainReason).toContain("not found");
      expect(plainReason).toContain("Available profiles:");
    });

    it("should return error when no cursor profiles directory found", async () => {
      // Remove cursor profiles directory
      await fs.rm(cursorProfilesDir, { recursive: true, force: true });

      const input = createInput({ prompt: "/nori-switch-profile amol" });
      const result = await cursorNoriSwitchProfile.run({ input });

      expect(result).not.toBeNull();
      expect(result!.decision).toBe("block");
      expect(stripAnsi(result!.reason!)).toContain("No profiles found");
    });
  });

  describe("config updates", () => {
    it("should update cursorProfile field, not profile field", async () => {
      // Set up config with both fields
      await fs.writeFile(
        configPath,
        JSON.stringify({
          profile: {
            baseProfile: "claude-profile",
          },
          cursorProfile: {
            baseProfile: "senior-swe",
          },
        }),
      );

      const input = createInput({ prompt: "/nori-switch-profile amol" });
      await cursorNoriSwitchProfile.run({ input });

      // Verify cursorProfile was updated but profile was not
      const updatedConfig = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(updatedConfig.cursorProfile.baseProfile).toBe("amol");
      // Profile field should be unchanged
      expect(updatedConfig.profile.baseProfile).toBe("claude-profile");
    });
  });
});
