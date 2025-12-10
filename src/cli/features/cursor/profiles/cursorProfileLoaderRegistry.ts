/**
 * Cursor profile loader registry for profile-dependent feature installation
 * Singleton registry that manages loaders for features that depend on profile composition
 */

import { cursorAgentsMdLoader } from "@/cli/features/cursor/profiles/agentsmd/loader.js";
import { cursorSkillsLoader } from "@/cli/features/cursor/profiles/skills/loader.js";

import type { Config } from "@/cli/config.js";
import type { ValidationResult } from "@/cli/features/loaderRegistry.js";

/**
 * Cursor profile loader interface for profile-dependent feature installation
 * Uses 'install' instead of 'run' to distinguish from main loaders
 */
export type CursorProfileLoader = {
  name: string;
  description: string;
  install: (args: { config: Config }) => Promise<void>;
  uninstall: (args: { config: Config }) => Promise<void>;
  validate?: (args: { config: Config }) => Promise<ValidationResult>;
};

/**
 * Registry singleton for managing cursor profile loaders
 */
export class CursorProfileLoaderRegistry {
  private static instance: CursorProfileLoaderRegistry | null = null;
  private loaders: Map<string, CursorProfileLoader>;

  private constructor() {
    this.loaders = new Map();

    // Register all cursor profile loaders
    // Order matters: skills must be installed before agentsmd (which reads from skills)
    this.loaders.set(cursorSkillsLoader.name, cursorSkillsLoader);
    this.loaders.set(cursorAgentsMdLoader.name, cursorAgentsMdLoader);
  }

  /**
   * Get the singleton instance
   * @returns The CursorProfileLoaderRegistry singleton instance
   */
  public static getInstance(): CursorProfileLoaderRegistry {
    if (CursorProfileLoaderRegistry.instance == null) {
      CursorProfileLoaderRegistry.instance = new CursorProfileLoaderRegistry();
    }
    return CursorProfileLoaderRegistry.instance;
  }

  /**
   * Get all registered profile loaders
   * @returns Array of all profile loaders
   */
  public getAll(): Array<CursorProfileLoader> {
    return Array.from(this.loaders.values());
  }

  /**
   * Get all registered profile loaders in reverse order (for uninstall)
   * @returns Array of all profile loaders in reverse order
   */
  public getAllReversed(): Array<CursorProfileLoader> {
    return Array.from(this.loaders.values()).reverse();
  }
}
