/**
 * Agent types and interfaces
 * Defines the contract that each agent implementation must satisfy
 */

import type { LoaderRegistry } from "@/cli/features/claude-code/loaderRegistry.js";

/**
 * Environment paths specific to each agent
 */
export type AgentEnvPaths = {
  /** Agent config directory, e.g., ".claude" or ".cursor" */
  configDir: string;
  /** Instructions file, e.g., "CLAUDE.md" or "AGENTS.md" */
  instructionsFile: string;
  /** Path to settings.json */
  settingsFile: string;
  /** Slash commands directory */
  commandsDir: string;
  /** Skills directory (may be null for some agents) */
  skillsDir: string;
  /** Profiles directory (may be null for some agents) */
  profilesDir: string;
};

/**
 * Agent interface that each agent implementation must satisfy
 */
export type Agent = {
  /** Unique identifier, e.g., "claude-code" */
  name: string;
  /** Human-readable name, e.g., "Claude Code" */
  displayName: string;
  /** Get the LoaderRegistry for this agent */
  getLoaderRegistry: () => LoaderRegistry;
  /** Get environment paths for this agent */
  getEnvPaths: (args: { installDir: string }) => AgentEnvPaths;
};
