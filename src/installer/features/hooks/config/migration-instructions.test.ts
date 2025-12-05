/**
 * Tests for migration instructions hook
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { main } from "./migration-instructions.js";

// Store console output
let consoleOutput: Array<string> = [];
const originalConsoleLog = console.log;

// Mock analytics to prevent actual tracking
vi.mock("@/installer/analytics.js", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("migration-instructions hook", () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    // Create temp directory for test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-hook-test-"));

    // Mock HOME
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;

    // Capture console output
    consoleOutput = [];
    console.log = (...args: Array<unknown>) => {
      consoleOutput.push(args.map(String).join(" "));
    };
  });

  afterEach(() => {
    // Restore HOME
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }

    // Restore console
    console.log = originalConsoleLog;

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should output red systemMessage when profiles exist in .claude/profiles/", async () => {
    // Setup: Create install directory with profiles in old location
    const installDir = path.join(tempDir, "project");
    const oldProfilesDir = path.join(installDir, ".claude", "profiles");
    const profileDir = path.join(oldProfilesDir, "my-profile");
    fs.mkdirSync(profileDir, { recursive: true });

    // Create nori config to mark as installation
    fs.writeFileSync(
      path.join(installDir, ".nori-config.json"),
      JSON.stringify({ profile: { baseProfile: "test" } }),
    );

    // Run the hook
    await main({ installDir });

    // Verify JSON output with systemMessage
    expect(consoleOutput).toHaveLength(1);
    const output = JSON.parse(consoleOutput[0]);
    expect(output).toHaveProperty("systemMessage");
    expect(output.systemMessage).toContain(".claude/profiles");
    expect(output.systemMessage).toContain(".nori/profiles");
    // Check for ANSI red color codes
    expect(output.systemMessage).toContain("\x1b[0;31m");
  });

  it("should output nothing when .claude/profiles/ does not exist", async () => {
    // Setup: Create install directory without profiles
    const installDir = path.join(tempDir, "project");
    fs.mkdirSync(path.join(installDir, ".claude"), { recursive: true });

    // Create nori config
    fs.writeFileSync(
      path.join(installDir, ".nori-config.json"),
      JSON.stringify({ profile: { baseProfile: "test" } }),
    );

    // Run the hook
    await main({ installDir });

    // Verify no output
    expect(consoleOutput).toHaveLength(0);
  });

  it("should output nothing when .claude/profiles/ exists but is empty", async () => {
    // Setup: Create empty profiles directory
    const installDir = path.join(tempDir, "project");
    const oldProfilesDir = path.join(installDir, ".claude", "profiles");
    fs.mkdirSync(oldProfilesDir, { recursive: true });

    // Create nori config
    fs.writeFileSync(
      path.join(installDir, ".nori-config.json"),
      JSON.stringify({ profile: { baseProfile: "test" } }),
    );

    // Run the hook
    await main({ installDir });

    // Verify no output
    expect(consoleOutput).toHaveLength(0);
  });

  it("should ignore hidden files like .DS_Store in profiles directory", async () => {
    // Setup: Create profiles directory with only hidden files
    const installDir = path.join(tempDir, "project");
    const oldProfilesDir = path.join(installDir, ".claude", "profiles");
    fs.mkdirSync(oldProfilesDir, { recursive: true });
    fs.writeFileSync(path.join(oldProfilesDir, ".DS_Store"), "");
    fs.writeFileSync(path.join(oldProfilesDir, ".gitkeep"), "");

    // Create nori config
    fs.writeFileSync(
      path.join(installDir, ".nori-config.json"),
      JSON.stringify({ profile: { baseProfile: "test" } }),
    );

    // Run the hook
    await main({ installDir });

    // Verify no output (hidden files should be ignored)
    expect(consoleOutput).toHaveLength(0);
  });

  it("should list all profile directories in the migration message", async () => {
    // Setup: Create multiple profiles
    const installDir = path.join(tempDir, "project");
    const oldProfilesDir = path.join(installDir, ".claude", "profiles");
    fs.mkdirSync(path.join(oldProfilesDir, "profile-one"), { recursive: true });
    fs.mkdirSync(path.join(oldProfilesDir, "profile-two"), { recursive: true });

    // Create nori config
    fs.writeFileSync(
      path.join(installDir, ".nori-config.json"),
      JSON.stringify({ profile: { baseProfile: "test" } }),
    );

    // Run the hook
    await main({ installDir });

    // Verify output mentions both profiles
    expect(consoleOutput).toHaveLength(1);
    const output = JSON.parse(consoleOutput[0]);
    expect(output.systemMessage).toContain("profile-one");
    expect(output.systemMessage).toContain("profile-two");
  });

  it("should not throw errors and exit gracefully on filesystem errors", async () => {
    // Setup: Invalid config path that would cause an error
    const invalidDir = path.join(tempDir, "nonexistent", "path");

    // Run the hook - should not throw
    await expect(main({ installDir: invalidDir })).resolves.not.toThrow();

    // Hook should exit gracefully with no output
    expect(consoleOutput).toHaveLength(0);
  });

  it("should detect profiles when running without explicit installDir", async () => {
    // Setup: Create profiles in temp home directory
    const oldProfilesDir = path.join(tempDir, ".claude", "profiles");
    const profileDir = path.join(oldProfilesDir, "my-profile");
    fs.mkdirSync(profileDir, { recursive: true });

    // Create nori config at temp home
    fs.writeFileSync(
      path.join(tempDir, ".nori-config.json"),
      JSON.stringify({ profile: { baseProfile: "test" } }),
    );

    // Run the hook without explicit installDir (simulates real usage)
    await main({ installDir: tempDir });

    // Verify output
    expect(consoleOutput).toHaveLength(1);
    const output = JSON.parse(consoleOutput[0]);
    expect(output).toHaveProperty("systemMessage");
  });
});
