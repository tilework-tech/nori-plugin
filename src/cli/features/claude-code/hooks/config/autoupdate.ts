#!/usr/bin/env node

/**
 * Hook handler for checking nori-skillsets updates
 *
 * This script is called by Claude Code SessionStart hook.
 * It checks npm registry for updates and notifies the user.
 */

import { execSync } from "child_process";
import { existsSync } from "fs";

import semver from "semver";

import { loadConfig } from "@/cli/config.js";
import {
  buildCLIEventParams,
  getUserId,
  sendAnalyticsEvent,
} from "@/cli/installTracking.js";
import { debug } from "@/cli/logger.js";
import { getInstallDirs } from "@/utils/path.js";

const PACKAGE_NAME = "nori-skillsets";

/**
 * Get the latest version from npm registry
 * @returns The latest version string or null if not found
 */
const getLatestVersion = async (): Promise<string | null> => {
  try {
    const output = execSync(`npm view ${PACKAGE_NAME} version`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.trim();
  } catch {
    return null;
  }
};

/**
 * Output hook result with additionalContext
 * @param args - Configuration arguments
 * @param args.message - Message to output
 */
const logToClaudeSession = (args: { message: string }): void => {
  const { message } = args;

  const output = {
    systemMessage: message,
  };

  console.log(JSON.stringify(output));
};

/**
 * Main entry point
 */
const main = async (): Promise<void> => {
  const cwd = process.cwd();

  // Find Nori installation by searching upward from cwd
  const allInstallations = getInstallDirs({ currentDir: cwd });
  const configDir = allInstallations.length > 0 ? allInstallations[0] : null;

  if (configDir == null) {
    // No config found - log to consolidated log file and exit
    debug({
      message:
        `=== Nori Autoupdate Error: ${new Date().toISOString()} ===\n` +
        `Could not find .nori-config.json in current directory or any parent directory.\n` +
        `Searched from: ${cwd}`,
    });
    return;
  }

  // Load config from found directory
  const diskConfig = await loadConfig({ installDir: configDir });

  if (diskConfig?.installDir == null) {
    // Config exists but has no installDir - log error and exit
    debug({
      message:
        `=== Nori Autoupdate Error: ${new Date().toISOString()} ===\n` +
        `Config file exists at ${configDir} but has no installDir field.`,
    });
    return;
  }

  const installDir = diskConfig.installDir;

  // Validate that installDir exists
  if (!existsSync(installDir)) {
    debug({
      message:
        `=== Nori Autoupdate Error: ${new Date().toISOString()} ===\n` +
        `Config specifies installDir: ${installDir} but directory does not exist.`,
    });
    return;
  }

  // Get installed version from config
  if (diskConfig.version == null) {
    throw new Error(
      "Installation out of date: no version field found in .nori-config.json file.",
    );
  }
  const installedVersion = diskConfig.version;

  // Check for updates
  const latestVersion = await getLatestVersion();
  const updateAvailable =
    latestVersion != null &&
    semver.valid(latestVersion) != null &&
    semver.gt(latestVersion, installedVersion);

  // Track session start (fire and forget - non-blocking)
  void (async () => {
    try {
      const cliParams = await buildCLIEventParams({
        config: diskConfig,
        currentVersion: installedVersion,
      });
      const userId = await getUserId({ config: diskConfig });
      sendAnalyticsEvent({
        eventName: "claude_session_started",
        eventParams: {
          ...cliParams,
          tilework_cli_update_available: updateAvailable,
        },
        userId,
      });
    } catch {
      // Silent failure - never interrupt session startup for analytics
    }
  })();

  if (!updateAvailable) {
    // No update needed (either no latest version found, invalid version,
    // or installed version is already >= latest version)
    return;
  }

  // Notify user that an update is available
  logToClaudeSession({
    message: `Nori Skillsets v${latestVersion} available (current: v${installedVersion}). Run 'npm install -g nori-skillsets' to update, then 'nori-skillsets switch-skillset <your-skillset>' to apply.`,
  });
};

// Export for testing
export { main };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    logToClaudeSession({
      message: `Nori Error: ${err instanceof Error ? err.message : String(err)}`,
    });
  });
}
