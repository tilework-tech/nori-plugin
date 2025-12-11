/**
 * Tests for switch-profile command
 * Tests that the CLI correctly delegates to agent methods
 */

import * as fs from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { AgentRegistry } from "@/cli/features/agentRegistry.js";

// Mock the env module
vi.mock("@/cli/env.js", () => ({
  getClaudeDir: (args: { installDir: string }) =>
    path.join(args.installDir, ".claude"),
  getClaudeSettingsFile: (args: { installDir: string }) =>
    path.join(args.installDir, ".claude", "settings.json"),
  getClaudeAgentsDir: (args: { installDir: string }) =>
    path.join(args.installDir, ".claude", "agents"),
  getClaudeCommandsDir: (args: { installDir: string }) =>
    path.join(args.installDir, ".claude", "commands"),
  getClaudeMdFile: (args: { installDir: string }) =>
    path.join(args.installDir, ".claude", "CLAUDE.md"),
  getClaudeSkillsDir: (args: { installDir: string }) =>
    path.join(args.installDir, ".claude", "skills"),
  getClaudeProfilesDir: (args: { installDir: string }) =>
    path.join(args.installDir, ".claude", "profiles"),
  MCP_ROOT: "/mock/mcp/root",
}));

describe("agent.listProfiles", () => {
  let testInstallDir: string;

  beforeEach(async () => {
    testInstallDir = await fs.mkdtemp(path.join(tmpdir(), "profiles-test-"));
    const testClaudeDir = path.join(testInstallDir, ".claude");
    await fs.mkdir(testClaudeDir, { recursive: true });
    AgentRegistry.resetInstance();
  });

  afterEach(async () => {
    if (testInstallDir) {
      await fs.rm(testInstallDir, { recursive: true, force: true });
    }
    AgentRegistry.resetInstance();
  });

  it("should list all installed profiles", async () => {
    const profilesDir = path.join(testInstallDir, ".claude", "profiles");
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

    const agent = AgentRegistry.getInstance().get({ name: "claude-code" });
    const profiles = await agent.listProfiles({ installDir: testInstallDir });

    expect(profiles).toContain("amol");
    expect(profiles).toContain("senior-swe");
  });
});

describe("agent.switchProfile", () => {
  let testInstallDir: string;

  beforeEach(async () => {
    testInstallDir = await fs.mkdtemp(path.join(tmpdir(), "switch-test-"));
    const testClaudeDir = path.join(testInstallDir, ".claude");
    await fs.mkdir(testClaudeDir, { recursive: true });
    AgentRegistry.resetInstance();
  });

  afterEach(async () => {
    if (testInstallDir) {
      await fs.rm(testInstallDir, { recursive: true, force: true });
    }
    AgentRegistry.resetInstance();
  });

  it("should preserve registryAuths when switching profiles", async () => {
    // Create profiles directory with test profiles
    const profilesDir = path.join(testInstallDir, ".claude", "profiles");
    await fs.mkdir(profilesDir, { recursive: true });

    for (const name of ["profile-a", "profile-b"]) {
      const dir = path.join(profilesDir, name);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "CLAUDE.md"), `# ${name}`);
    }

    // Create initial config with registryAuths
    const configPath = path.join(testInstallDir, ".nori-config.json");
    const initialConfig = {
      profile: { baseProfile: "profile-a" },
      registryAuths: [
        {
          username: "test@example.com",
          password: "secret123",
          registryUrl: "https://private.registry.com",
        },
      ],
      sendSessionTranscript: "enabled",
    };
    await fs.writeFile(configPath, JSON.stringify(initialConfig, null, 2));

    // Switch to profile-b using agent method
    const agent = AgentRegistry.getInstance().get({ name: "claude-code" });
    await agent.switchProfile({
      installDir: testInstallDir,
      profileName: "profile-b",
    });

    // Verify registryAuths was preserved
    const updatedConfig = JSON.parse(await fs.readFile(configPath, "utf-8"));
    expect(updatedConfig.agents?.["claude-code"]?.profile?.baseProfile).toBe(
      "profile-b",
    );
    expect(updatedConfig.registryAuths).toEqual([
      {
        username: "test@example.com",
        password: "secret123",
        registryUrl: "https://private.registry.com",
      },
    ]);
  });
});
