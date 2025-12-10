/**
 * Cursor-specific intercepted slash command for switching profiles
 * Handles /nori-switch-profile commands for instant profile switching
 * Uses ~/.cursor/profiles/ instead of ~/.claude/profiles/
 */

import * as fs from "fs/promises";
import * as path from "path";

import { getCursorProfilesDir } from "@/cli/env.js";
import { getInstallDirs } from "@/utils/path.js";

import type {
  HookInput,
  HookOutput,
  InterceptedSlashCommand,
} from "./types.js";

import { formatError, formatSuccess } from "./format.js";

/**
 * List available Cursor profiles in a directory
 * @param args - The function arguments
 * @param args.profilesDir - Path to the Cursor profiles directory
 *
 * @returns Array of profile names
 */
const listProfiles = async (args: {
  profilesDir: string;
}): Promise<Array<string>> => {
  const { profilesDir } = args;
  const profiles: Array<string> = [];

  try {
    await fs.access(profilesDir);
    const entries = await fs.readdir(profilesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const claudeMdPath = path.join(profilesDir, entry.name, "CLAUDE.md");
        try {
          await fs.access(claudeMdPath);
          profiles.push(entry.name);
        } catch {
          // Skip directories without CLAUDE.md
        }
      }
    }
  } catch {
    // Profiles directory doesn't exist
  }

  return profiles.sort();
};

/**
 * Switch to a Cursor profile
 * @param args - The function arguments
 * @param args.profileName - Name of the profile to switch to
 * @param args.profilesDir - Path to the Cursor profiles directory
 * @param args.installDir - Path to the installation directory
 */
const switchProfile = async (args: {
  profileName: string;
  profilesDir: string;
  installDir: string;
}): Promise<void> => {
  const { profileName, profilesDir, installDir } = args;

  // Verify profile exists
  const profileDir = path.join(profilesDir, profileName);
  const claudeMdPath = path.join(profileDir, "CLAUDE.md");

  try {
    await fs.access(claudeMdPath);
  } catch {
    throw new Error(`Profile "${profileName}" not found`);
  }

  // Config is always in the install directory
  const configPath = path.join(installDir, ".nori-config.json");

  // Load current config to preserve auth and other fields
  let currentConfig: Record<string, unknown> = {};
  try {
    const content = await fs.readFile(configPath, "utf-8");
    currentConfig = JSON.parse(content);
  } catch {
    // No existing config
  }

  // Update config with new CURSOR profile (cursorProfile, not profile)
  const newConfig = {
    ...currentConfig,
    cursorProfile: {
      baseProfile: profileName,
    },
  };

  await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));
};

/**
 * Run the nori-switch-profile command for Cursor
 * @param args - The function arguments
 * @param args.input - The hook input containing prompt and cwd
 *
 * @returns The hook output with switch result, or null if not matched
 */
const run = async (args: { input: HookInput }): Promise<HookOutput | null> => {
  const { input } = args;
  const { prompt, cwd } = input;

  // Extract profile name if provided (matcher already validated the pattern)
  const trimmedPrompt = prompt.trim();
  const profileMatch = trimmedPrompt.match(
    /^\/nori-switch-profile(?:\s+([a-z0-9-]+))?\s*$/i,
  );
  const profileName = profileMatch?.[1] ?? null;

  // Find installation directory
  const allInstallations = getInstallDirs({ currentDir: cwd });

  if (allInstallations.length === 0) {
    return {
      decision: "block",
      reason: formatError({ message: `No Nori installation found.` }),
    };
  }

  const installDir = allInstallations[0]; // Use closest installation

  // CRITICAL: Use Cursor profiles directory, not Claude
  const profilesDir = getCursorProfilesDir({ installDir });

  // List available profiles
  const profiles = await listProfiles({ profilesDir });

  if (profiles.length === 0) {
    return {
      decision: "block",
      reason: formatError({
        message: `No profiles found in ${profilesDir}.\n\nRun 'nori-ai install-cursor' to install profiles.`,
      }),
    };
  }

  // If no profile name provided, show available profiles
  if (profileName == null) {
    return {
      decision: "block",
      reason: formatSuccess({
        message: `Available profiles: ${profiles.join(", ")}\n\nUsage: /nori-switch-profile <profile-name>`,
      }),
    };
  }

  // Check if profile exists
  if (!profiles.includes(profileName)) {
    return {
      decision: "block",
      reason: formatError({
        message: `Profile "${profileName}" not found.\n\nAvailable profiles: ${profiles.join(", ")}`,
      }),
    };
  }

  // Switch to the profile
  try {
    await switchProfile({ profileName, profilesDir, installDir });

    // Read profile description if available
    let profileDescription = "";
    try {
      const profileJsonPath = path.join(
        profilesDir,
        profileName,
        "profile.json",
      );
      const profileJson = JSON.parse(
        await fs.readFile(profileJsonPath, "utf-8"),
      );
      if (profileJson.description) {
        profileDescription = profileJson.description;
      }
    } catch {
      // No profile.json or no description
    }

    return {
      decision: "block",
      reason: formatSuccess({
        message: `Profile switched to "${profileName}"${profileDescription ? `: ${profileDescription}` : ""}.\n\nRestart Cursor to apply the changes.`,
      }),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      decision: "block",
      reason: formatError({
        message: `Failed to switch profile: ${errorMessage}`,
      }),
    };
  }
};

/**
 * Cursor nori-switch-profile intercepted slash command
 */
export const cursorNoriSwitchProfile: InterceptedSlashCommand = {
  matchers: [
    "^\\/nori-switch-profile\\s*$",
    "^\\/nori-switch-profile\\s+[a-z0-9-]+\\s*$",
  ],
  run,
};
