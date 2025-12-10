/**
 * Tests for Cursor AGENTS.md feature loader
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
let mockCursorAgentsMdFile: string;

vi.mock("@/cli/env.js", () => ({
  getCursorDir: () => mockCursorDir,
  getCursorSettingsFile: () => path.join(mockCursorDir, "settings.json"),
  getCursorSkillsDir: () => path.join(mockCursorDir, "skills"),
  getCursorProfilesDir: () => path.join(mockCursorDir, "profiles"),
  getCursorAgentsMdFile: () => mockCursorAgentsMdFile,
  // Also mock Claude paths since they may be used internally
  getClaudeDir: () => mockCursorDir,
  getClaudeSettingsFile: () => path.join(mockCursorDir, "settings.json"),
  getClaudeSkillsDir: () => path.join(mockCursorDir, "skills"),
  getClaudeProfilesDir: () => path.join(mockCursorDir, "profiles"),
  getClaudeMdFile: () => path.join(mockCursorDir, "CLAUDE.md"),
  getClaudeAgentsDir: () => path.join(mockCursorDir, "agents"),
  getClaudeCommandsDir: () => path.join(mockCursorDir, "commands"),
  MCP_ROOT: "/mock/mcp/root",
}));

// Import loader after mocking env
import { cursorAgentsMdLoader } from "./loader.js";

describe("cursorAgentsMdLoader", () => {
  let tempDir: string;
  let cursorDir: string;
  let agentsMdPath: string;

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cursor-agentsmd-test-"));
    cursorDir = path.join(tempDir, ".cursor");
    agentsMdPath = path.join(cursorDir, "AGENTS.md");

    // Set mock paths
    mockCursorDir = cursorDir;
    mockCursorAgentsMdFile = agentsMdPath;

    // Create .cursor directory
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
    it("should create AGENTS.md with managed block", async () => {
      const config: Config = { installDir: tempDir };

      await cursorAgentsMdLoader.install({ config });

      // Verify file exists
      const content = await fs.readFile(agentsMdPath, "utf-8");

      // Check for managed block markers
      expect(content).toContain("# BEGIN NORI-AI MANAGED BLOCK");
      expect(content).toContain("# END NORI-AI MANAGED BLOCK");

      // Check for core content sections from profile AGENTS.md
      expect(content).toContain("# Tone");
    });

    it("should append managed block to existing AGENTS.md without destroying user content", async () => {
      const config: Config = { installDir: tempDir };

      // Create existing AGENTS.md with user content
      const userContent =
        "# My Custom Instructions\n\nUser-specific content here.\n";
      await fs.writeFile(agentsMdPath, userContent);

      await cursorAgentsMdLoader.install({ config });

      // Verify file exists
      const content = await fs.readFile(agentsMdPath, "utf-8");

      // Check that user content is preserved
      expect(content).toContain("# My Custom Instructions");
      expect(content).toContain("User-specific content here.");

      // Check for managed block
      expect(content).toContain("# BEGIN NORI-AI MANAGED BLOCK");
      expect(content).toContain("# END NORI-AI MANAGED BLOCK");
    });

    it("should update existing managed block without affecting user content", async () => {
      const config: Config = { installDir: tempDir };

      // Create existing AGENTS.md with managed block and user content
      const existingContent = `# User Content Before

User-specific instructions.

# BEGIN NORI-AI MANAGED BLOCK
Old nori instructions here.
# END NORI-AI MANAGED BLOCK

# User Content After

More user instructions.
`;
      await fs.writeFile(agentsMdPath, existingContent);

      await cursorAgentsMdLoader.install({ config });

      // Verify file exists
      const content = await fs.readFile(agentsMdPath, "utf-8");

      // Check that user content is preserved
      expect(content).toContain("# User Content Before");
      expect(content).toContain("User-specific instructions.");
      expect(content).toContain("# User Content After");
      expect(content).toContain("More user instructions.");

      // Check that managed block is updated
      expect(content).toContain("# BEGIN NORI-AI MANAGED BLOCK");
      expect(content).toContain("# END NORI-AI MANAGED BLOCK");

      // Old content should be replaced
      expect(content).not.toContain("Old nori instructions here.");

      // New content should be present
      expect(content).toContain("# Tone");
    });

    it("should load AGENTS.md from selected profile", async () => {
      const config: Config = {
        profile: { baseProfile: "senior-swe" },
        installDir: tempDir,
      };

      await cursorAgentsMdLoader.install({ config });

      const content = await fs.readFile(agentsMdPath, "utf-8");

      // Should contain content from senior-swe profile's AGENTS.md
      expect(content).toContain("BEGIN NORI-AI MANAGED BLOCK");
      expect(content).toContain("<required>");
    });

    it("should use default profile (senior-swe) when no profile specified", async () => {
      const config: Config = { installDir: tempDir };

      await cursorAgentsMdLoader.install({ config });

      const content = await fs.readFile(agentsMdPath, "utf-8");

      // Should use senior-swe as default
      expect(content).toContain("# Tone");
      expect(content).toContain("<required>");
    });
  });

  describe("uninstall", () => {
    it("should remove managed block from AGENTS.md", async () => {
      const config: Config = { installDir: tempDir };

      // First install
      await cursorAgentsMdLoader.install({ config });

      // Add some user content before uninstalling
      let content = await fs.readFile(agentsMdPath, "utf-8");
      content = `# My Custom Instructions\n\n${content}\n\n# More Custom Stuff\n`;
      await fs.writeFile(agentsMdPath, content);

      // Uninstall
      await cursorAgentsMdLoader.uninstall({ config });

      // Verify managed block is removed
      const finalContent = await fs.readFile(agentsMdPath, "utf-8");

      expect(finalContent).not.toContain("# BEGIN NORI-AI MANAGED BLOCK");
      expect(finalContent).not.toContain("# END NORI-AI MANAGED BLOCK");
      expect(finalContent).not.toContain("# Tone");

      // User content should be preserved
      expect(finalContent).toContain("# My Custom Instructions");
      expect(finalContent).toContain("# More Custom Stuff");
    });

    it("should delete AGENTS.md if empty after removing managed block", async () => {
      const config: Config = { installDir: tempDir };

      // Install (creates AGENTS.md with only managed block)
      await cursorAgentsMdLoader.install({ config });

      // Uninstall
      await cursorAgentsMdLoader.uninstall({ config });

      // Verify file is deleted
      const exists = await fs
        .access(agentsMdPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(false);
    });

    it("should handle missing AGENTS.md gracefully", async () => {
      const config: Config = { installDir: tempDir };

      // Uninstall without installing first (no AGENTS.md exists)
      await expect(
        cursorAgentsMdLoader.uninstall({ config }),
      ).resolves.not.toThrow();

      // Verify file still doesn't exist
      const exists = await fs
        .access(agentsMdPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(false);
    });

    it("should handle AGENTS.md without managed block gracefully", async () => {
      const config: Config = { installDir: tempDir };

      // Create AGENTS.md without managed block
      const userContent = "# User Instructions\n\nNo nori content here.\n";
      await fs.writeFile(agentsMdPath, userContent);

      // Uninstall
      await cursorAgentsMdLoader.uninstall({ config });

      // Verify content is unchanged
      const content = await fs.readFile(agentsMdPath, "utf-8");
      expect(content).toBe(userContent);
    });
  });

  describe("validate", () => {
    it("should return valid when AGENTS.md is installed correctly", async () => {
      const config: Config = { installDir: tempDir };

      // Install
      await cursorAgentsMdLoader.install({ config });

      // Validate
      if (cursorAgentsMdLoader.validate == null) {
        throw new Error("validate method not implemented");
      }

      const result = await cursorAgentsMdLoader.validate({ config });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it("should return invalid when AGENTS.md is missing", async () => {
      const config: Config = { installDir: tempDir };

      // Remove the AGENTS.md that was created by beforeEach (via cursorProfilesLoader.run)
      try {
        await fs.unlink(agentsMdPath);
      } catch {
        // Already doesn't exist
      }

      // Validate
      if (cursorAgentsMdLoader.validate == null) {
        throw new Error("validate method not implemented");
      }

      const result = await cursorAgentsMdLoader.validate({ config });

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it("should return invalid when managed block is missing", async () => {
      const config: Config = { installDir: tempDir };

      // Create AGENTS.md without managed block
      await fs.writeFile(agentsMdPath, "# Just user content\n");

      // Validate
      if (cursorAgentsMdLoader.validate == null) {
        throw new Error("validate method not implemented");
      }

      const result = await cursorAgentsMdLoader.validate({ config });

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });
  });

  describe("skills list generation", () => {
    it("should include skills list in installed AGENTS.md", async () => {
      const config: Config = {
        profile: { baseProfile: "senior-swe" },
        installDir: tempDir,
      };

      await cursorAgentsMdLoader.install({ config });

      const content = await fs.readFile(agentsMdPath, "utf-8");

      // Should contain skills list section
      expect(content).toContain("Available Skills");

      // Should list at least some skills from senior-swe profile
      expect(content).toContain(`${cursorDir}/skills/using-skills/SKILL.md`);
    });

    it("should include skill name and description from frontmatter", async () => {
      const config: Config = {
        profile: { baseProfile: "senior-swe" },
        installDir: tempDir,
      };

      await cursorAgentsMdLoader.install({ config });

      const content = await fs.readFile(agentsMdPath, "utf-8");

      // Should include skill metadata (names and descriptions from frontmatter)
      expect(content).toContain("Name:");
      expect(content).toContain("Description:");
    });
  });

  describe("template substitution", () => {
    it("should apply template substitution to AGENTS.md content", async () => {
      const config: Config = { installDir: tempDir };

      await cursorAgentsMdLoader.install({ config });

      const content = await fs.readFile(agentsMdPath, "utf-8");

      // Should have template placeholders substituted
      expect(content).not.toContain("{{skills_dir}}");
      expect(content).not.toContain("{{install_dir}}");
    });
  });
});
