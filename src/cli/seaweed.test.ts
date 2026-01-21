/**
 * Tests for the seaweed CLI
 *
 * The seaweed CLI is a minimal registry-focused CLI that only provides:
 * - registry-search
 * - registry-download
 * - registry-upload
 * - registry-update
 * - registry-install
 * - version (built-in)
 *
 * It does NOT provide nori-ai commands like install, uninstall, check, etc.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("seaweed CLI", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "seaweed-cli-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should have the correct CLI name", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    // Verify the CLI is named "seaweed"
    expect(output).toContain("Usage: seaweed");
  });

  it("should show version when --version flag is used", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --version", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    // Should output a version number (e.g., "19.1.6")
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("should have registry-search command", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).toContain("registry-search");
  });

  it("should have registry-download command", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).toContain("registry-download");
  });

  it("should have registry-upload command", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).toContain("registry-upload");
  });

  it("should have registry-update command", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).toContain("registry-update");
  });

  it("should have registry-install command", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).toContain("registry-install");
  });

  it("should NOT have install command (nori-ai only)", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    // Should not have "install" as a standalone command (registry-install is OK)
    // Look for "install " with a space to avoid matching "registry-install"
    const lines = output.split("\n");
    const hasStandaloneInstall = lines.some(
      (line) =>
        line.trim().startsWith("install ") ||
        line.trim().startsWith("install\t") ||
        line.match(/^\s*install\s+\[/),
    );
    expect(hasStandaloneInstall).toBe(false);
  });

  it("should NOT have uninstall command (nori-ai only)", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).not.toContain("uninstall");
  });

  it("should NOT have check command (nori-ai only)", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).not.toContain("check");
  });

  it("should NOT have switch-profile command (nori-ai only)", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).not.toContain("switch-profile");
  });

  it("should NOT have skill-search command (nori-ai only)", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).not.toContain("skill-search");
  });

  it("should NOT have skill-download command (nori-ai only)", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).not.toContain("skill-download");
  });

  it("should NOT have skill-upload command (nori-ai only)", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js --help", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).not.toContain("skill-upload");
  });

  it("should show help when no arguments provided", () => {
    let output = "";

    try {
      output = execSync("node build/src/cli/seaweed.js", {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, FORCE_COLOR: "0", HOME: tempDir },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object") {
        const execError = error as { stdout?: string; stderr?: string };
        output = execError.stdout || execError.stderr || "";
      }
    }

    expect(output).toContain("Usage: seaweed");
    expect(output).toContain("Commands:");
  });
});
