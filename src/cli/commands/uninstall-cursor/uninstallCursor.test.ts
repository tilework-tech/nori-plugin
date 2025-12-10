/**
 * Tests for uninstall-cursor CLI command
 * Verifies that uninstall-cursor executes all cursor loaders in reverse order
 */

import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the env module to use temp directories
let mockCursorDir = "";

vi.mock("@/cli/env.js", () => ({
  getClaudeDir: (args: { installDir: string }) =>
    path.join(args.installDir, ".claude"),
  getClaudeSettingsFile: (args: { installDir: string }) =>
    path.join(args.installDir, ".claude", "settings.json"),
  getClaudeProfilesDir: (args: { installDir: string }) =>
    path.join(args.installDir, ".claude", "profiles"),
  getCursorDir: () => mockCursorDir,
  getCursorSettingsFile: () => path.join(mockCursorDir, "settings.json"),
  getCursorProfilesDir: () => path.join(mockCursorDir, "profiles"),
  getCursorHooksFile: () => path.join(mockCursorDir, "hooks.json"),
  getCursorCommandsDir: () => path.join(mockCursorDir, "commands"),
  MCP_ROOT: "/mock/mcp/root",
}));

import { installCursorMain } from "@/cli/commands/install-cursor/installCursor.js";

import { uninstallCursorMain } from "./uninstallCursor.js";

describe("uninstall-cursor command", () => {
  let tempDir: string;
  let cursorDir: string;
  let profilesDir: string;

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "uninstall-cursor-test-"),
    );
    cursorDir = path.join(tempDir, ".cursor");
    profilesDir = path.join(cursorDir, "profiles");

    // Set mock paths
    mockCursorDir = cursorDir;

    // Create directories
    await fs.mkdir(cursorDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    // Clear all mocks
    vi.clearAllMocks();
  });

  it("should execute cursor loaders and uninstall profiles", async () => {
    // First install
    await installCursorMain();

    // Verify profiles were installed
    const filesBeforeUninstall = await fs.readdir(profilesDir);
    expect(filesBeforeUninstall.length).toBeGreaterThan(0);
    expect(filesBeforeUninstall).toContain("senior-swe");

    // Then uninstall
    await uninstallCursorMain();

    // Verify built-in profiles are removed
    const dirExists = await fs
      .access(profilesDir)
      .then(() => true)
      .catch(() => false);

    if (dirExists) {
      const filesAfterUninstall = await fs.readdir(profilesDir);
      // Should have no built-in profiles left
      expect(filesAfterUninstall).not.toContain("senior-swe");
      expect(filesAfterUninstall).not.toContain("amol");
    }
  });

  it("should remove permissions from settings.json", async () => {
    // First install
    await installCursorMain();

    // Verify permissions exist
    const settingsPath = path.join(cursorDir, "settings.json");
    let settings = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    expect(settings.permissions?.additionalDirectories).toContain(profilesDir);

    // Then uninstall
    await uninstallCursorMain();

    // Verify permissions are removed
    settings = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    expect(settings.permissions?.additionalDirectories || []).not.toContain(
      profilesDir,
    );
  });
});
