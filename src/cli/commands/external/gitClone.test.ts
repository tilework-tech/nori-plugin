/**
 * Tests for git clone utility
 */

import { execFileSync } from "child_process";
import * as fs from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";

import { describe, it, expect, vi, beforeEach } from "vitest";

import { cloneRepo, cleanupClone, GitCloneError } from "./gitClone.js";

// Mock child_process
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

describe("cloneRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute shallow clone to a temp directory", async () => {
    vi.mocked(execFileSync).mockImplementation(() => Buffer.from(""));

    const result = await cloneRepo({
      url: "https://github.com/owner/repo.git",
    });

    expect(result).toContain(tmpdir());
    expect(execFileSync).toHaveBeenCalledTimes(1);

    const callArgs = vi.mocked(execFileSync).mock.calls[0];
    const binary = callArgs[0] as string;
    const args = callArgs[1] as Array<string>;
    expect(binary).toBe("git");
    expect(args).toContain("clone");
    expect(args).toContain("--depth");
    expect(args).toContain("1");
    expect(args).toContain("https://github.com/owner/repo.git");

    // Cleanup
    await fs.rm(result, { recursive: true, force: true });
  });

  it("should pass --branch when ref is provided", async () => {
    vi.mocked(execFileSync).mockImplementation(() => Buffer.from(""));

    const result = await cloneRepo({
      url: "https://github.com/owner/repo.git",
      ref: "develop",
    });

    const callArgs = vi.mocked(execFileSync).mock.calls[0];
    const args = callArgs[1] as Array<string>;
    expect(args).toContain("--branch");
    expect(args).toContain("develop");

    // Cleanup
    await fs.rm(result, { recursive: true, force: true });
  });

  it("should throw GitCloneError on authentication failure", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("Authentication failed for 'https://github.com/...'");
    });

    await expect(
      cloneRepo({ url: "https://github.com/private/repo.git" }),
    ).rejects.toThrow(GitCloneError);

    try {
      await cloneRepo({ url: "https://github.com/private/repo.git" });
    } catch (err) {
      expect(err).toBeInstanceOf(GitCloneError);
      expect((err as GitCloneError).isAuthError).toBe(true);
      expect((err as GitCloneError).isTimeout).toBe(false);
    }
  });

  it("should throw GitCloneError on timeout", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      const err = new Error("timed out");
      (err as NodeJS.ErrnoException).code = "ETIMEDOUT";
      throw err;
    });

    try {
      await cloneRepo({ url: "https://github.com/owner/repo.git" });
    } catch (err) {
      expect(err).toBeInstanceOf(GitCloneError);
      expect((err as GitCloneError).isTimeout).toBe(true);
    }
  });

  it("should throw GitCloneError on repository not found", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("Repository not found");
    });

    try {
      await cloneRepo({ url: "https://github.com/owner/nonexistent.git" });
    } catch (err) {
      expect(err).toBeInstanceOf(GitCloneError);
      expect((err as GitCloneError).isAuthError).toBe(true);
    }
  });

  it("should throw generic GitCloneError on unknown failures", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("Something unexpected happened");
    });

    try {
      await cloneRepo({ url: "https://github.com/owner/repo.git" });
    } catch (err) {
      expect(err).toBeInstanceOf(GitCloneError);
      expect((err as GitCloneError).isAuthError).toBe(false);
      expect((err as GitCloneError).isTimeout).toBe(false);
    }
  });
});

describe("cleanupClone", () => {
  it("should remove a directory within tmpdir", async () => {
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), "nori-test-cleanup-"));
    await fs.writeFile(path.join(tempDir, "test.txt"), "test");

    await cleanupClone({ dir: tempDir });

    await expect(fs.access(tempDir)).rejects.toThrow();
  });

  it("should throw when attempting to delete outside tmpdir", async () => {
    await expect(cleanupClone({ dir: "/home/user/important" })).rejects.toThrow(
      "outside",
    );
  });

  it("should not throw when directory does not exist", async () => {
    const nonExistent = path.join(tmpdir(), "nori-nonexistent-dir-12345");
    await expect(cleanupClone({ dir: nonExistent })).resolves.toBeUndefined();
  });
});
