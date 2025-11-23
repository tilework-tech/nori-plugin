import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { detectNoriPollution } from "./setup.js";

describe("detectNoriPollution", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pollution-test-"));
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should return empty array for clean directory", () => {
    const pollution = detectNoriPollution(tempDir);
    expect(pollution).toEqual([]);
  });

  it("should not detect pollution when only settings.local.json exists", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(
      path.join(claudeDir, "settings.local.json"),
      JSON.stringify({ test: true }),
    );

    const pollution = detectNoriPollution(tempDir);
    expect(pollution).toEqual([]);
  });

  it("should detect .nori-config.json", () => {
    fs.writeFileSync(
      path.join(tempDir, ".nori-config.json"),
      JSON.stringify({}),
    );

    const pollution = detectNoriPollution(tempDir);
    expect(pollution).toContain(".nori-config.json");
  });

  it("should detect .nori-installed-version", () => {
    fs.writeFileSync(path.join(tempDir, ".nori-installed-version"), "1.0.0");

    const pollution = detectNoriPollution(tempDir);
    expect(pollution).toContain(".nori-installed-version");
  });

  it("should detect .nori-notifications.log", () => {
    fs.writeFileSync(path.join(tempDir, ".nori-notifications.log"), "logs");

    const pollution = detectNoriPollution(tempDir);
    expect(pollution).toContain(".nori-notifications.log");
  });

  it("should detect Nori directories in .claude", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(claudeDir);

    const noriDirs = ["profiles", "skills", "agents", "commands", "hooks"];
    for (const dir of noriDirs) {
      fs.mkdirSync(path.join(claudeDir, dir));
    }

    const pollution = detectNoriPollution(tempDir);
    expect(pollution).toContain(".claude/profiles");
    expect(pollution).toContain(".claude/skills");
    expect(pollution).toContain(".claude/agents");
    expect(pollution).toContain(".claude/commands");
    expect(pollution).toContain(".claude/hooks");
  });

  it("should detect CLAUDE.md with Nori managed block", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "# BEGIN NORI-AI MANAGED BLOCK\nSome content\n# END NORI-AI MANAGED BLOCK",
    );

    const pollution = detectNoriPollution(tempDir);
    expect(pollution).toContain(".claude/CLAUDE.md");
  });

  it("should not detect CLAUDE.md without Nori managed block", () => {
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(
      path.join(claudeDir, "CLAUDE.md"),
      "# Some user content\nNo Nori here",
    );

    const pollution = detectNoriPollution(tempDir);
    expect(pollution).not.toContain(".claude/CLAUDE.md");
  });

  it("should detect multiple pollution sources at once", () => {
    // Create multiple pollution sources
    fs.writeFileSync(
      path.join(tempDir, ".nori-config.json"),
      JSON.stringify({}),
    );
    const claudeDir = path.join(tempDir, ".claude");
    fs.mkdirSync(claudeDir);
    fs.mkdirSync(path.join(claudeDir, "skills"));
    fs.mkdirSync(path.join(claudeDir, "profiles"));

    const pollution = detectNoriPollution(tempDir);
    expect(pollution).toContain(".nori-config.json");
    expect(pollution).toContain(".claude/skills");
    expect(pollution).toContain(".claude/profiles");
  });
});
