/**
 * Tests for Cursor skills feature loader
 * Verifies install, uninstall, and validate operations for Cursor IDE
 */

import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { cursorProfilesLoader } from "@/cli/features/cursor/profiles/loader.js";

import type { Config } from "@/cli/config.js";

// Mock the env module to use temp directories
let mockCursorDir: string;
let mockCursorSkillsDir: string;

vi.mock("@/cli/env.js", () => ({
  getCursorDir: () => mockCursorDir,
  getCursorSettingsFile: () => path.join(mockCursorDir, "settings.json"),
  getCursorSkillsDir: () => mockCursorSkillsDir,
  getCursorProfilesDir: () => path.join(mockCursorDir, "profiles"),
  getCursorAgentsMdFile: () => path.join(mockCursorDir, "AGENTS.md"),
  // Also mock Claude paths since they may be used internally
  getClaudeDir: () => mockCursorDir,
  getClaudeSettingsFile: () => path.join(mockCursorDir, "settings.json"),
  getClaudeSkillsDir: () => mockCursorSkillsDir,
  getClaudeProfilesDir: () => path.join(mockCursorDir, "profiles"),
  getClaudeMdFile: () => path.join(mockCursorDir, "CLAUDE.md"),
  getClaudeAgentsDir: () => path.join(mockCursorDir, "agents"),
  getClaudeCommandsDir: () => path.join(mockCursorDir, "commands"),
  MCP_ROOT: "/mock/mcp/root",
}));

// Import loader after mocking env
import { cursorSkillsLoader } from "./loader.js";

describe("cursorSkillsLoader", () => {
  let tempDir: string;
  let cursorDir: string;
  let skillsDir: string;

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cursor-skills-test-"));
    cursorDir = path.join(tempDir, ".cursor");
    skillsDir = path.join(cursorDir, "skills");

    // Set mock paths
    mockCursorDir = cursorDir;
    mockCursorSkillsDir = skillsDir;

    // Create directories
    await fs.mkdir(cursorDir, { recursive: true });

    // Run cursor profiles loader to populate ~/.cursor/profiles/ directory
    const config: Config = { installDir: tempDir };
    await cursorProfilesLoader.run({ config });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe("install", () => {
    it("should create skills directory", async () => {
      const config: Config = { installDir: tempDir };

      await cursorSkillsLoader.install({ config });

      // Verify skills directory exists
      const exists = await fs
        .access(skillsDir)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });

    it("should remove existing skills directory before installing", async () => {
      const config: Config = { installDir: tempDir };

      // Create skills directory with existing files
      await fs.mkdir(skillsDir, { recursive: true });
      await fs.writeFile(path.join(skillsDir, "old-skill.json"), "old content");

      await cursorSkillsLoader.install({ config });

      // Verify old file is gone
      const oldFileExists = await fs
        .access(path.join(skillsDir, "old-skill.json"))
        .then(() => true)
        .catch(() => false);

      expect(oldFileExists).toBe(false);
    });

    it("should handle reinstallation (update scenario)", async () => {
      const config: Config = { installDir: tempDir };

      // First installation
      await cursorSkillsLoader.install({ config });

      const firstCheck = await fs
        .access(skillsDir)
        .then(() => true)
        .catch(() => false);
      expect(firstCheck).toBe(true);

      // Second installation (update)
      await cursorSkillsLoader.install({ config });

      const secondCheck = await fs
        .access(skillsDir)
        .then(() => true)
        .catch(() => false);
      expect(secondCheck).toBe(true);
    });

    it("should install skills from cursor profiles directory", async () => {
      const config: Config = { installDir: tempDir };

      await cursorSkillsLoader.install({ config });

      // Check if a standard skill exists
      const skillPath = path.join(skillsDir, "using-skills", "SKILL.md");

      const exists = await fs
        .access(skillPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });
  });

  describe("uninstall", () => {
    it("should remove skills directory", async () => {
      const config: Config = { installDir: tempDir };

      // Install first
      await cursorSkillsLoader.install({ config });

      // Verify it exists
      let exists = await fs
        .access(skillsDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Uninstall
      await cursorSkillsLoader.uninstall({ config });

      // Verify it's removed
      exists = await fs
        .access(skillsDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it("should handle missing skills directory gracefully", async () => {
      const config: Config = { installDir: tempDir };

      // Uninstall without installing first
      await expect(
        cursorSkillsLoader.uninstall({ config }),
      ).resolves.not.toThrow();

      // Verify directory still doesn't exist
      const exists = await fs
        .access(skillsDir)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(false);
    });
  });

  describe("template substitution", () => {
    it("should apply template substitution to skill markdown files", async () => {
      const config: Config = { installDir: tempDir };

      await cursorSkillsLoader.install({ config });

      // Check a skill that references {{skills_dir}}
      const skillPath = path.join(skillsDir, "using-skills", "SKILL.md");
      const content = await fs.readFile(skillPath, "utf-8");

      // Should have template placeholders substituted
      expect(content).not.toContain("{{skills_dir}}");
      expect(content).not.toContain("{{install_dir}}");
    });
  });

  describe("paid skills", () => {
    it("should install paid-prefixed skills without prefix for paid tier", async () => {
      const config: Config = {
        auth: {
          username: "test",
          password: "test",
          organizationUrl: "https://test.com",
        },
        installDir: tempDir,
      };

      // Recompose profiles with paid mixin
      await cursorProfilesLoader.run({ config });

      await cursorSkillsLoader.install({ config });

      // Should exist without prefix
      const memorizeExists = await fs
        .access(path.join(skillsDir, "memorize", "SKILL.md"))
        .then(() => true)
        .catch(() => false);

      expect(memorizeExists).toBe(true);

      // Should not exist with prefix
      const paidMemorizeExists = await fs
        .access(path.join(skillsDir, "paid-memorize", "SKILL.md"))
        .then(() => true)
        .catch(() => false);

      expect(paidMemorizeExists).toBe(false);
    });

    it("should not install paid-prefixed skills for free tier", async () => {
      const config: Config = { installDir: tempDir };

      await cursorSkillsLoader.install({ config });

      // Should not exist with or without prefix
      const memorizeExists = await fs
        .access(path.join(skillsDir, "memorize", "SKILL.md"))
        .then(() => true)
        .catch(() => false);

      expect(memorizeExists).toBe(false);

      const paidMemorizeExists = await fs
        .access(path.join(skillsDir, "paid-memorize", "SKILL.md"))
        .then(() => true)
        .catch(() => false);

      expect(paidMemorizeExists).toBe(false);
    });
  });

  describe("permissions configuration", () => {
    it("should configure permissions.additionalDirectories in settings.json", async () => {
      const config: Config = { installDir: tempDir };
      const settingsPath = path.join(cursorDir, "settings.json");

      await cursorSkillsLoader.install({ config });

      // Verify settings.json exists
      const exists = await fs
        .access(settingsPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Verify permissions are configured
      const content = await fs.readFile(settingsPath, "utf-8");
      const settings = JSON.parse(content);

      expect(settings.permissions).toBeDefined();
      expect(settings.permissions.additionalDirectories).toBeDefined();
      expect(settings.permissions.additionalDirectories).toContain(skillsDir);
    });

    it("should preserve existing settings when adding permissions", async () => {
      const config: Config = { installDir: tempDir };
      const settingsPath = path.join(cursorDir, "settings.json");

      // Create settings.json with existing configuration
      await fs.writeFile(
        settingsPath,
        JSON.stringify(
          {
            $schema: "https://json.schemastore.org/claude-code-settings.json",
            model: "sonnet",
            existingField: "should-be-preserved",
          },
          null,
          2,
        ),
      );

      await cursorSkillsLoader.install({ config });

      // Verify existing settings are preserved
      const content = await fs.readFile(settingsPath, "utf-8");
      const settings = JSON.parse(content);

      expect(settings.model).toBe("sonnet");
      expect(settings.existingField).toBe("should-be-preserved");
      expect(settings.permissions.additionalDirectories).toContain(skillsDir);
    });

    it("should remove permissions on uninstall", async () => {
      const config: Config = { installDir: tempDir };
      const settingsPath = path.join(cursorDir, "settings.json");

      // Install first
      await cursorSkillsLoader.install({ config });

      // Verify permissions are configured
      let content = await fs.readFile(settingsPath, "utf-8");
      let settings = JSON.parse(content);
      expect(settings.permissions.additionalDirectories).toContain(skillsDir);

      // Uninstall
      await cursorSkillsLoader.uninstall({ config });

      // Verify permissions are removed
      content = await fs.readFile(settingsPath, "utf-8");
      settings = JSON.parse(content);

      expect(
        settings.permissions?.additionalDirectories?.includes(skillsDir),
      ).toBeFalsy();
    });
  });

  describe("validate", () => {
    it("should return valid when skills are installed correctly", async () => {
      const config: Config = { installDir: tempDir };

      // Install
      await cursorSkillsLoader.install({ config });

      // Validate
      if (cursorSkillsLoader.validate == null) {
        throw new Error("validate method not implemented");
      }

      const result = await cursorSkillsLoader.validate({ config });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it("should return invalid when skills directory is missing", async () => {
      const config: Config = { installDir: tempDir };

      // Remove the skills directory that was created by beforeEach
      await fs.rm(skillsDir, { recursive: true, force: true });

      // Validate
      if (cursorSkillsLoader.validate == null) {
        throw new Error("validate method not implemented");
      }

      const result = await cursorSkillsLoader.validate({ config });

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });
  });
});
