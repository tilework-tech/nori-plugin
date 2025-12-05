/**
 * Migration instruction: Check for profiles in old .claude/profiles/ location
 */

import * as fs from "fs";
import * as path from "path";

import type { MigrationInstruction } from "./types.js";

/**
 * Check if profiles exist in old .claude/profiles/ location
 * and instruct users to migrate them to .nori/profiles/
 */
export const oldProfilesLocation: MigrationInstruction = {
  trigger: (args: { installDir: string }): string | null => {
    const { installDir } = args;

    const oldProfilesDir = path.join(installDir, ".claude", "profiles");

    // Check if directory exists
    if (!fs.existsSync(oldProfilesDir)) {
      return null;
    }

    // Get directory entries, filtering out hidden files
    let entries: Array<string>;
    try {
      entries = fs
        .readdirSync(oldProfilesDir)
        .filter((entry) => !entry.startsWith("."));
    } catch {
      return null;
    }

    // Check if there are any non-hidden entries (profiles)
    if (entries.length === 0) {
      return null;
    }

    // Build migration message
    const newProfilesDir = path.join(installDir, ".nori", "profiles");
    let message = "⚠️ **Profile Migration Required**\n\n";
    message += `Found profiles in old location: ${oldProfilesDir}\n\n`;
    message += "**Profiles found:**\n";
    for (const entry of entries) {
      message += `- ${entry}\n`;
    }
    message += "\n**To migrate, move your profiles to the new location:**\n";
    message += `\`mv ${oldProfilesDir}/* ${newProfilesDir}/\`\n`;

    return message;
  },
};
