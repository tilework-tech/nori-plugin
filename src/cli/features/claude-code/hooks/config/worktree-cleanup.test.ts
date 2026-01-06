/**
 * Tests for worktree cleanup warning hook
 *
 * This hook warns users when git worktrees are consuming excessive disk space
 * (>50GB) or when system disk space is low (<10% free).
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { main } from "./worktree-cleanup.js";

// Store console output
let consoleOutput: Array<string> = [];
const originalConsoleLog = console.log;

// Mock analytics to prevent actual tracking
vi.mock("@/cli/analytics.js", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("worktree-cleanup hook", () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    // Create temp directory for test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-cleanup-test-"));

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

  it("should output nothing when not in a git repo", async () => {
    // Setup: Create a directory that is not a git repo
    const nonGitDir = path.join(tempDir, "not-a-git-repo");
    fs.mkdirSync(nonGitDir, { recursive: true });

    // Run the hook
    await main({ cwd: nonGitDir });

    // Verify no output
    expect(consoleOutput).toHaveLength(0);
  });

  it("should output nothing when no additional worktrees exist", async () => {
    // Setup: Create a git repo with no additional worktrees
    const gitDir = path.join(tempDir, "git-repo");
    fs.mkdirSync(gitDir, { recursive: true });

    // Initialize git repo
    const { execSync } = await import("child_process");
    execSync("git init", { cwd: gitDir, stdio: "ignore" });
    execSync("git config user.email 'test@test.com'", {
      cwd: gitDir,
      stdio: "ignore",
    });
    execSync("git config user.name 'Test'", { cwd: gitDir, stdio: "ignore" });
    fs.writeFileSync(path.join(gitDir, "README.md"), "# Test");
    execSync("git add .", { cwd: gitDir, stdio: "ignore" });
    execSync("git commit -m 'init'", { cwd: gitDir, stdio: "ignore" });

    // Run the hook
    await main({ cwd: gitDir });

    // Verify no output (only main worktree exists)
    expect(consoleOutput).toHaveLength(0);
  });

  it("should output nothing when worktrees are small and disk space is sufficient", async () => {
    // Setup: Create a git repo with a small worktree
    const gitDir = path.join(tempDir, "git-repo");
    const worktreeDir = path.join(tempDir, "worktree-1");
    fs.mkdirSync(gitDir, { recursive: true });

    // Initialize git repo
    const { execSync } = await import("child_process");
    execSync("git init", { cwd: gitDir, stdio: "ignore" });
    execSync("git config user.email 'test@test.com'", {
      cwd: gitDir,
      stdio: "ignore",
    });
    execSync("git config user.name 'Test'", { cwd: gitDir, stdio: "ignore" });
    fs.writeFileSync(path.join(gitDir, "README.md"), "# Test");
    execSync("git add .", { cwd: gitDir, stdio: "ignore" });
    execSync("git commit -m 'init'", { cwd: gitDir, stdio: "ignore" });

    // Create a worktree
    execSync(`git worktree add "${worktreeDir}" -b test-branch`, {
      cwd: gitDir,
      stdio: "ignore",
    });

    // Run the hook (worktree is tiny, disk space should be sufficient)
    await main({ cwd: gitDir });

    // Verify no output
    expect(consoleOutput).toHaveLength(0);

    // Cleanup worktree
    execSync(`git worktree remove "${worktreeDir}"`, {
      cwd: gitDir,
      stdio: "ignore",
    });
  });

  it("should output warning when worktrees exceed 50GB", async () => {
    // Setup: Create a git repo and mock the size calculation
    const gitDir = path.join(tempDir, "git-repo");
    fs.mkdirSync(gitDir, { recursive: true });

    // Initialize git repo
    const { execSync } = await import("child_process");
    execSync("git init", { cwd: gitDir, stdio: "ignore" });
    execSync("git config user.email 'test@test.com'", {
      cwd: gitDir,
      stdio: "ignore",
    });
    execSync("git config user.name 'Test'", { cwd: gitDir, stdio: "ignore" });
    fs.writeFileSync(path.join(gitDir, "README.md"), "# Test");
    execSync("git add .", { cwd: gitDir, stdio: "ignore" });
    execSync("git commit -m 'init'", { cwd: gitDir, stdio: "ignore" });

    // Create a worktree
    const worktreeDir = path.join(tempDir, "worktree-large");
    execSync(`git worktree add "${worktreeDir}" -b large-branch`, {
      cwd: gitDir,
      stdio: "ignore",
    });

    // Run the hook with mocked size (simulating >50GB)
    // 55GB in bytes = 55 * 1024 * 1024 * 1024
    await main({
      cwd: gitDir,
      __testOverrides: {
        worktreeSizeBytes: 55 * 1024 * 1024 * 1024,
        diskSpacePercent: 50, // Plenty of disk space
      },
    });

    // Verify warning output
    expect(consoleOutput).toHaveLength(1);
    const output = JSON.parse(consoleOutput[0]);
    expect(output).toHaveProperty("hookSpecificOutput");
    expect(output.hookSpecificOutput).toHaveProperty("additionalContext");
    expect(output.hookSpecificOutput.additionalContext).toContain("⚠️");
    expect(output.hookSpecificOutput.additionalContext).toContain("worktree");
    expect(output.hookSpecificOutput.additionalContext).toMatch(
      /50\s*GB|55\s*GB/i,
    ); // Should mention threshold or actual size

    // Cleanup worktree
    execSync(`git worktree remove "${worktreeDir}"`, {
      cwd: gitDir,
      stdio: "ignore",
    });
  });

  it("should output warning when disk space is below 10%", async () => {
    // Setup: Create a git repo with a worktree
    const gitDir = path.join(tempDir, "git-repo");
    fs.mkdirSync(gitDir, { recursive: true });

    // Initialize git repo
    const { execSync } = await import("child_process");
    execSync("git init", { cwd: gitDir, stdio: "ignore" });
    execSync("git config user.email 'test@test.com'", {
      cwd: gitDir,
      stdio: "ignore",
    });
    execSync("git config user.name 'Test'", { cwd: gitDir, stdio: "ignore" });
    fs.writeFileSync(path.join(gitDir, "README.md"), "# Test");
    execSync("git add .", { cwd: gitDir, stdio: "ignore" });
    execSync("git commit -m 'init'", { cwd: gitDir, stdio: "ignore" });

    // Create a worktree
    const worktreeDir = path.join(tempDir, "worktree-low-disk");
    execSync(`git worktree add "${worktreeDir}" -b low-disk-branch`, {
      cwd: gitDir,
      stdio: "ignore",
    });

    // Run the hook with mocked disk space (simulating <10% free)
    await main({
      cwd: gitDir,
      __testOverrides: {
        worktreeSizeBytes: 1 * 1024 * 1024 * 1024, // 1GB - small worktrees
        diskSpacePercent: 5, // Only 5% disk space remaining
      },
    });

    // Verify warning output
    expect(consoleOutput).toHaveLength(1);
    const output = JSON.parse(consoleOutput[0]);
    expect(output).toHaveProperty("hookSpecificOutput");
    expect(output.hookSpecificOutput).toHaveProperty("additionalContext");
    expect(output.hookSpecificOutput.additionalContext).toContain("⚠️");
    expect(output.hookSpecificOutput.additionalContext).toMatch(
      /disk\s*space/i,
    );

    // Cleanup worktree
    execSync(`git worktree remove "${worktreeDir}"`, {
      cwd: gitDir,
      stdio: "ignore",
    });
  });

  it("should include worktree paths and sizes in warning message", async () => {
    // Setup: Create a git repo with multiple worktrees
    const gitDir = path.join(tempDir, "git-repo");
    fs.mkdirSync(gitDir, { recursive: true });

    // Initialize git repo
    const { execSync } = await import("child_process");
    execSync("git init", { cwd: gitDir, stdio: "ignore" });
    execSync("git config user.email 'test@test.com'", {
      cwd: gitDir,
      stdio: "ignore",
    });
    execSync("git config user.name 'Test'", { cwd: gitDir, stdio: "ignore" });
    fs.writeFileSync(path.join(gitDir, "README.md"), "# Test");
    execSync("git add .", { cwd: gitDir, stdio: "ignore" });
    execSync("git commit -m 'init'", { cwd: gitDir, stdio: "ignore" });

    // Create multiple worktrees
    const worktree1 = path.join(tempDir, "worktree-a");
    const worktree2 = path.join(tempDir, "worktree-b");
    execSync(`git worktree add "${worktree1}" -b branch-a`, {
      cwd: gitDir,
      stdio: "ignore",
    });
    execSync(`git worktree add "${worktree2}" -b branch-b`, {
      cwd: gitDir,
      stdio: "ignore",
    });

    // Run the hook with mocked large size
    await main({
      cwd: gitDir,
      __testOverrides: {
        worktreeSizeBytes: 60 * 1024 * 1024 * 1024, // 60GB
        diskSpacePercent: 50,
      },
    });

    // Verify warning includes worktree paths
    expect(consoleOutput).toHaveLength(1);
    const output = JSON.parse(consoleOutput[0]);
    expect(output.hookSpecificOutput.additionalContext).toContain(worktree1);
    expect(output.hookSpecificOutput.additionalContext).toContain(worktree2);

    // Cleanup worktrees
    execSync(`git worktree remove "${worktree1}"`, {
      cwd: gitDir,
      stdio: "ignore",
    });
    execSync(`git worktree remove "${worktree2}"`, {
      cwd: gitDir,
      stdio: "ignore",
    });
  });

  it("should ask user about removing worktrees in the warning message", async () => {
    // Setup: Create a git repo with a worktree
    const gitDir = path.join(tempDir, "git-repo");
    fs.mkdirSync(gitDir, { recursive: true });

    // Initialize git repo
    const { execSync } = await import("child_process");
    execSync("git init", { cwd: gitDir, stdio: "ignore" });
    execSync("git config user.email 'test@test.com'", {
      cwd: gitDir,
      stdio: "ignore",
    });
    execSync("git config user.name 'Test'", { cwd: gitDir, stdio: "ignore" });
    fs.writeFileSync(path.join(gitDir, "README.md"), "# Test");
    execSync("git add .", { cwd: gitDir, stdio: "ignore" });
    execSync("git commit -m 'init'", { cwd: gitDir, stdio: "ignore" });

    // Create a worktree
    const worktreeDir = path.join(tempDir, "worktree-question");
    execSync(`git worktree add "${worktreeDir}" -b question-branch`, {
      cwd: gitDir,
      stdio: "ignore",
    });

    // Run the hook with mocked large size
    await main({
      cwd: gitDir,
      __testOverrides: {
        worktreeSizeBytes: 55 * 1024 * 1024 * 1024, // 55GB
        diskSpacePercent: 50,
      },
    });

    // Verify warning asks user about cleanup
    expect(consoleOutput).toHaveLength(1);
    const output = JSON.parse(consoleOutput[0]);
    // Should ask user - look for question-like phrasing
    expect(output.hookSpecificOutput.additionalContext).toMatch(
      /remove|clean\s*up|delete|should.*help|would.*like/i,
    );

    // Cleanup worktree
    execSync(`git worktree remove "${worktreeDir}"`, {
      cwd: gitDir,
      stdio: "ignore",
    });
  });

  it("should not throw errors and exit gracefully on invalid paths", async () => {
    // Setup: Invalid cwd that doesn't exist
    const invalidDir = path.join(tempDir, "nonexistent", "path", "deep");

    // Run the hook - should not throw
    await expect(main({ cwd: invalidDir })).resolves.not.toThrow();

    // Hook should exit gracefully with no output
    expect(consoleOutput).toHaveLength(0);
  });

  it("should include disk space information in warning", async () => {
    // Setup: Create a git repo with a worktree
    const gitDir = path.join(tempDir, "git-repo");
    fs.mkdirSync(gitDir, { recursive: true });

    // Initialize git repo
    const { execSync } = await import("child_process");
    execSync("git init", { cwd: gitDir, stdio: "ignore" });
    execSync("git config user.email 'test@test.com'", {
      cwd: gitDir,
      stdio: "ignore",
    });
    execSync("git config user.name 'Test'", { cwd: gitDir, stdio: "ignore" });
    fs.writeFileSync(path.join(gitDir, "README.md"), "# Test");
    execSync("git add .", { cwd: gitDir, stdio: "ignore" });
    execSync("git commit -m 'init'", { cwd: gitDir, stdio: "ignore" });

    // Create a worktree
    const worktreeDir = path.join(tempDir, "worktree-disk-info");
    execSync(`git worktree add "${worktreeDir}" -b disk-info-branch`, {
      cwd: gitDir,
      stdio: "ignore",
    });

    // Run the hook with mocked values
    await main({
      cwd: gitDir,
      __testOverrides: {
        worktreeSizeBytes: 55 * 1024 * 1024 * 1024, // 55GB
        diskSpacePercent: 8, // 8% remaining
        diskSpaceAvailableBytes: 80 * 1024 * 1024 * 1024, // 80GB available
      },
    });

    // Verify warning includes disk space info
    expect(consoleOutput).toHaveLength(1);
    const output = JSON.parse(consoleOutput[0]);
    // Should mention available disk space
    expect(output.hookSpecificOutput.additionalContext).toMatch(
      /available|remaining|free/i,
    );
    // Should include a size measurement
    expect(output.hookSpecificOutput.additionalContext).toMatch(/GB/i);

    // Cleanup worktree
    execSync(`git worktree remove "${worktreeDir}"`, {
      cwd: gitDir,
      stdio: "ignore",
    });
  });
});
