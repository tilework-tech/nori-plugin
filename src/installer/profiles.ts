/**
 * Profile management for Nori Agent Brain
 * Handles profile listing, loading, and switching
 */

import * as fs from "fs/promises";
import * as path from "path";

import { loadDiskConfig, saveDiskConfig } from "@/installer/config.js";
import { CLAUDE_PROFILES_DIR } from "@/installer/env.js";
import { success, info } from "@/installer/logger.js";

/**
 * List all available profiles from ~/.claude/profiles/
 * @returns Array of profile names
 */
export const listProfiles = async (): Promise<Array<string>> => {
  const profiles: Array<string> = [];

  try {
    // Check if profiles directory exists
    await fs.access(CLAUDE_PROFILES_DIR);

    // Read all directories in profiles directory
    const entries = await fs.readdir(CLAUDE_PROFILES_DIR, {
      withFileTypes: true,
    });

    // Get all directories that contain a CLAUDE.md file
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const claudeMdPath = path.join(
          CLAUDE_PROFILES_DIR,
          entry.name,
          "CLAUDE.md",
        );
        try {
          await fs.access(claudeMdPath);
          profiles.push(entry.name);
        } catch {
          // Skip directories without CLAUDE.md
        }
      }
    }
  } catch (err: any) {
    throw new Error(
      `Failed to list profiles from ${CLAUDE_PROFILES_DIR}: ${err.message}`,
    );
  }

  return profiles;
};

/**
 * Switch to a profile by name
 * Preserves auth credentials, updates profile selection
 * @param args - Function arguments
 * @param args.profileName - Name of profile to switch to
 */
export const switchProfile = async (args: {
  profileName: string;
}): Promise<void> => {
  const { profileName } = args;

  // 1. Verify profile exists by checking for CLAUDE.md in profile directory
  const profileDir = path.join(CLAUDE_PROFILES_DIR, profileName);
  try {
    const claudeMdPath = path.join(profileDir, "CLAUDE.md");
    await fs.access(claudeMdPath);
  } catch {
    throw new Error(
      `Profile "${profileName}" not found in ${CLAUDE_PROFILES_DIR}`,
    );
  }

  // 2. Load current disk config
  const currentConfig = await loadDiskConfig();

  // 3. Preserve auth, update profile
  await saveDiskConfig({
    username: currentConfig?.auth?.username || null,
    password: currentConfig?.auth?.password || null,
    organizationUrl: currentConfig?.auth?.organizationUrl || null,
    profile: {
      baseProfile: profileName,
    },
  });

  success({ message: `Switched to "${profileName}" profile` });
  info({
    message: `Restart Claude Code to load the new profile configuration`,
  });
};
