/**
 * Claude Code agent implementation
 * Implements the Agent interface for Claude Code
 */

import * as fs from "fs/promises";
import * as path from "path";

import { loadConfig, saveConfig } from "@/cli/config.js";
import { LoaderRegistry } from "@/cli/features/claude-code/loaderRegistry.js";
import { success, info } from "@/cli/logger.js";

import type { Agent } from "@/cli/features/agentRegistry.js";

/** Instructions file name for Claude Code */
const INSTRUCTIONS_FILE = "CLAUDE.md";

/**
 * Get the profiles directory path for Claude Code
 * @param args - Configuration arguments
 * @param args.installDir - Installation directory
 *
 * @returns Path to the profiles directory
 */
const getProfilesDir = (args: { installDir: string }): string => {
  const { installDir } = args;
  return path.join(installDir, ".claude", "profiles");
};

/**
 * Claude Code agent implementation
 */
export const claudeCodeAgent: Agent = {
  name: "claude-code",
  displayName: "Claude Code",

  getLoaderRegistry: () => {
    return LoaderRegistry.getInstance();
  },

  listProfiles: async (args: {
    installDir: string;
  }): Promise<Array<string>> => {
    const { installDir } = args;
    const profilesDir = getProfilesDir({ installDir });
    const profiles: Array<string> = [];

    try {
      await fs.access(profilesDir);
      const entries = await fs.readdir(profilesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const instructionsPath = path.join(
            profilesDir,
            entry.name,
            INSTRUCTIONS_FILE,
          );
          try {
            await fs.access(instructionsPath);
            profiles.push(entry.name);
          } catch {
            // Skip directories without instructions file
          }
        }
      }
    } catch {
      // Profiles directory doesn't exist
    }

    return profiles.sort();
  },

  switchProfile: async (args: {
    installDir: string;
    profileName: string;
  }): Promise<void> => {
    const { installDir, profileName } = args;
    const profilesDir = getProfilesDir({ installDir });

    // Verify profile exists
    const profileDir = path.join(profilesDir, profileName);
    const instructionsPath = path.join(profileDir, INSTRUCTIONS_FILE);

    try {
      await fs.access(instructionsPath);
    } catch {
      throw new Error(`Profile "${profileName}" not found in ${profilesDir}`);
    }

    // Load current config
    const currentConfig = await loadConfig({ installDir });

    // Preserve auth and other settings, update profile for this agent
    const existingAgents = currentConfig?.agents ?? {};
    const updatedAgents = {
      ...existingAgents,
      ["claude-code"]: {
        ...existingAgents["claude-code"],
        profile: { baseProfile: profileName },
      },
    };

    await saveConfig({
      username: currentConfig?.auth?.username ?? null,
      password: currentConfig?.auth?.password ?? null,
      organizationUrl: currentConfig?.auth?.organizationUrl ?? null,
      agents: updatedAgents,
      sendSessionTranscript: currentConfig?.sendSessionTranscript ?? null,
      autoupdate: currentConfig?.autoupdate,
      registryAuths: currentConfig?.registryAuths ?? null,
      installDir,
    });

    success({
      message: `Switched to "${profileName}" profile for Claude Code`,
    });
    info({
      message: `Restart Claude Code to load the new profile configuration`,
    });
  },
};
