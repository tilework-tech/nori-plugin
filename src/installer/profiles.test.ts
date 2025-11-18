import * as fs from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the CLAUDE_DIR before importing
let testClaudeDir: string;

vi.mock("@/installer/env.js", () => ({
  get CLAUDE_DIR() {
    return testClaudeDir;
  },
  get CLAUDE_MD_FILE() {
    return path.join(testClaudeDir, "CLAUDE.md");
  },
  get CLAUDE_SETTINGS_FILE() {
    return path.join(testClaudeDir, "settings.json");
  },
  get CLAUDE_AGENTS_DIR() {
    return path.join(testClaudeDir, "agents");
  },
  get CLAUDE_COMMANDS_DIR() {
    return path.join(testClaudeDir, "commands");
  },
  get CLAUDE_SKILLS_DIR() {
    return path.join(testClaudeDir, "skills");
  },
  get CLAUDE_PROFILES_DIR() {
    return path.join(testClaudeDir, "profiles");
  },
  MCP_ROOT: "/mock/mcp/root",
}));

describe("listProfiles", () => {
  beforeEach(async () => {
    testClaudeDir = await fs.mkdtemp(path.join(tmpdir(), "profiles-test-"));
  });

  afterEach(async () => {
    if (testClaudeDir) {
      await fs.rm(testClaudeDir, { recursive: true, force: true });
    }
  });

  it("should list all installed profiles", async () => {
    const profilesDir = path.join(testClaudeDir, "profiles");
    await fs.mkdir(profilesDir, { recursive: true });

    // Create user-facing profiles
    for (const name of ["amol", "senior-swe"]) {
      const dir = path.join(profilesDir, name);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "CLAUDE.md"), `# ${name}`);
      await fs.writeFile(
        path.join(dir, "profile.json"),
        JSON.stringify({ extends: "_base", name, description: "Test" }),
      );
    }

    const { listProfiles } = await import("./profiles.js");
    const profiles = await listProfiles();

    expect(profiles).toEqual(["amol", "senior-swe"]);
  });
});
