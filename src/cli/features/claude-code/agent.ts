/**
 * Claude Code agent implementation
 * Implements the Agent interface for Claude Code
 */

import * as path from "path";

import { LoaderRegistry } from "@/cli/features/claude-code/loaderRegistry.js";

import type { Agent, AgentEnvPaths } from "@/cli/features/types.js";

/**
 * Claude Code agent implementation
 */
export const claudeCodeAgent: Agent = {
  name: "claude-code",
  displayName: "Claude Code",

  getLoaderRegistry: () => {
    return LoaderRegistry.getInstance();
  },

  getEnvPaths: (args: { installDir: string }): AgentEnvPaths => {
    const { installDir } = args;
    const configDir = path.join(installDir, ".claude");

    return {
      configDir,
      instructionsFile: path.join(configDir, "CLAUDE.md"),
      settingsFile: path.join(configDir, "settings.json"),
      commandsDir: path.join(configDir, "commands"),
      skillsDir: path.join(configDir, "skills"),
      profilesDir: path.join(configDir, "profiles"),
    };
  },
};
