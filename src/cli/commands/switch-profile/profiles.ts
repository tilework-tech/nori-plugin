/**
 * Profile management for Nori Profiles
 * Handles profile listing, loading, and switching
 */

import * as fs from "fs/promises";
import * as path from "path";

import { loadConfig, saveConfig } from "@/cli/config.js";
import { AgentRegistry } from "@/cli/features/agentRegistry.js";
import { success, info } from "@/cli/logger.js";
import { normalizeInstallDir } from "@/utils/path.js";

import type { Command } from "commander";

/**
 * Register the 'switch-profile' command with commander
 * @param args - Configuration arguments
 * @param args.program - Commander program instance
 */
export const registerSwitchProfileCommand = (args: {
  program: Command;
}): void => {
  const { program } = args;

  program
    .command("switch-profile <name>")
    .description("Switch to a different profile and reinstall")
    .action(async (name: string) => {
      // Get global options from parent
      const globalOpts = program.opts();

      // Switch to the profile
      await switchProfile({
        profileName: name,
        installDir: globalOpts.installDir || null,
        agent: globalOpts.agent || null,
      });

      // Run install in non-interactive mode with skipUninstall
      // This preserves custom user profiles during the profile switch
      info({ message: "Applying profile configuration..." });
      const { main: installMain } = await import(
        "@/cli/commands/install/install.js"
      );
      await installMain({
        nonInteractive: true,
        skipUninstall: true,
        installDir: globalOpts.installDir || null,
        agent: globalOpts.agent || null,
      });
    });
};

/**
 * List all available profiles from the agent's profiles directory
 * @param args - Configuration arguments
 * @param args.installDir - Installation directory
 * @param args.agent - AI agent to use (defaults to claude-code)
 *
 * @returns Array of profile names
 */
export const listProfiles = async (args: {
  installDir: string;
  agent?: string | null;
}): Promise<Array<string>> => {
  const { installDir } = args;
  const agentName = args.agent ?? "claude-code";
  const agentImpl = AgentRegistry.getInstance().get({ name: agentName });
  const envPaths = agentImpl.getEnvPaths({ installDir });
  const profilesDir = envPaths.profilesDir;
  const profiles: Array<string> = [];

  try {
    // Check if profiles directory exists
    await fs.access(profilesDir);

    // Read all directories in profiles directory
    const entries = await fs.readdir(profilesDir, {
      withFileTypes: true,
    });

    // Get all directories that contain an instructions file (e.g., CLAUDE.md for claude-code)
    // Extract just the filename from the instructions file path
    const instructionsFileName = path.basename(envPaths.instructionsFile);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const instructionsPath = path.join(
          profilesDir,
          entry.name,
          instructionsFileName,
        );
        try {
          await fs.access(instructionsPath);
          profiles.push(entry.name);
        } catch {
          // Skip directories without instructions file
        }
      }
    }
  } catch (err: any) {
    throw new Error(
      `Failed to list profiles from ${profilesDir}: ${err.message}`,
    );
  }

  return profiles;
};

/**
 * Switch to a profile by name
 * Preserves auth credentials, updates profile selection
 * This is a CLI entry point that accepts optional installDir
 * @param args - Function arguments
 * @param args.profileName - Name of profile to switch to
 * @param args.installDir - Custom installation directory (optional, defaults to cwd)
 * @param args.agent - AI agent to use (defaults to claude-code)
 */
export const switchProfile = async (args: {
  profileName: string;
  installDir?: string | null;
  agent?: string | null;
}): Promise<void> => {
  const { profileName } = args;
  // Normalize installDir at entry point
  const installDir = normalizeInstallDir({ installDir: args.installDir });
  const agentName = args.agent ?? "claude-code";

  const agentImpl = AgentRegistry.getInstance().get({ name: agentName });
  const envPaths = agentImpl.getEnvPaths({ installDir });
  const profilesDir = envPaths.profilesDir;
  const instructionsFileName = path.basename(envPaths.instructionsFile);

  // 1. Verify profile exists by checking for instructions file in profile directory
  const profileDir = path.join(profilesDir, profileName);
  try {
    const instructionsPath = path.join(profileDir, instructionsFileName);
    await fs.access(instructionsPath);
  } catch {
    throw new Error(`Profile "${profileName}" not found in ${profilesDir}`);
  }

  // 2. Load current config
  const currentConfig = await loadConfig({ installDir });

  // 3. Preserve auth and other settings, update profile for the specific agent
  const existingAgents = currentConfig?.agents ?? {};
  const updatedAgents = {
    ...existingAgents,
    [agentName]: {
      ...existingAgents[agentName],
      profile: { baseProfile: profileName },
    },
  };

  await saveConfig({
    username: currentConfig?.auth?.username || null,
    password: currentConfig?.auth?.password || null,
    organizationUrl: currentConfig?.auth?.organizationUrl || null,
    agents: updatedAgents,
    sendSessionTranscript: currentConfig?.sendSessionTranscript ?? null,
    autoupdate: currentConfig?.autoupdate,
    registryAuths: currentConfig?.registryAuths ?? null,
    installDir,
  });

  success({
    message: `Switched to "${profileName}" profile for ${agentImpl.displayName}`,
  });
  info({
    message: `Restart ${agentImpl.displayName} to load the new profile configuration`,
  });
};
