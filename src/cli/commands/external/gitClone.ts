/**
 * Git clone utility for the external command
 *
 * Handles shallow-cloning GitHub repositories to temporary directories
 * with proper error handling and cleanup.
 */

import { execFileSync } from "child_process";
import * as fs from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";

const CLONE_TIMEOUT_MS = 60000;

/**
 * Error thrown when a git clone operation fails
 */
export class GitCloneError extends Error {
  readonly url: string;
  readonly isTimeout: boolean;
  readonly isAuthError: boolean;

  constructor(
    message: string,
    url: string,
    isTimeout = false,
    isAuthError = false,
  ) {
    super(message);
    this.name = "GitCloneError";
    this.url = url;
    this.isTimeout = isTimeout;
    this.isAuthError = isAuthError;
  }
}

/**
 * Shallow-clone a git repository to a temporary directory
 *
 * @param args - The function arguments
 * @param args.url - The repository URL to clone
 * @param args.ref - Optional branch or tag to checkout
 *
 * @throws GitCloneError on clone failure
 *
 * @returns Path to the cloned directory
 */
export const cloneRepo = async (args: {
  url: string;
  ref?: string | null;
}): Promise<string> => {
  const { url, ref } = args;

  const tempDir = await fs.mkdtemp(path.join(tmpdir(), "nori-external-"));

  const gitArgs = ["clone", "--depth", "1"];
  if (ref != null) {
    gitArgs.push("--branch", ref);
  }
  gitArgs.push(url, tempDir);

  try {
    execFileSync("git", gitArgs, {
      timeout: CLONE_TIMEOUT_MS,
      stdio: "pipe",
    });
    return tempDir;
  } catch (err) {
    // Clean up temp dir on failure
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
      // Best effort cleanup - ignore errors
    });

    const errorMessage = err instanceof Error ? err.message : String(err);

    const isTimeout =
      errorMessage.includes("timed out") ||
      errorMessage.includes("ETIMEDOUT") ||
      (err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "ETIMEDOUT");

    const isAuthError =
      errorMessage.includes("Authentication failed") ||
      errorMessage.includes("could not read Username") ||
      errorMessage.includes("Permission denied") ||
      errorMessage.includes("Repository not found");

    if (isTimeout) {
      throw new GitCloneError(
        `Clone timed out after 60s. This often happens with private repos that require authentication.\n` +
          `  Ensure you have access and your SSH keys or credentials are configured:\n` +
          `  - For SSH: ssh-add -l (to check loaded keys)\n` +
          `  - For HTTPS: gh auth status (if using GitHub CLI)`,
        url,
        true,
        false,
      );
    }

    if (isAuthError) {
      throw new GitCloneError(
        `Authentication failed for ${url}.\n` +
          `  - For private repos, ensure you have access\n` +
          `  - For SSH: Check your keys with 'ssh -T git@github.com'\n` +
          `  - For HTTPS: Run 'gh auth login' or configure git credentials`,
        url,
        false,
        true,
      );
    }

    throw new GitCloneError(
      `Failed to clone ${url}: ${errorMessage}`,
      url,
      false,
      false,
    );
  }
};

/**
 * Clean up a cloned temporary directory
 *
 * Validates the directory is within the system temp directory to prevent
 * accidental deletion of important files.
 *
 * @param args - The function arguments
 * @param args.dir - The directory to remove
 */
export const cleanupClone = async (args: { dir: string }): Promise<void> => {
  const { dir } = args;

  const normalizedDir = path.normalize(path.resolve(dir));
  const normalizedTmpDir = path.normalize(path.resolve(tmpdir()));

  if (!normalizedDir.startsWith(normalizedTmpDir + path.sep)) {
    throw new Error(
      "Attempted to clean up directory outside of temp directory",
    );
  }

  await fs.rm(dir, { recursive: true, force: true });
};
