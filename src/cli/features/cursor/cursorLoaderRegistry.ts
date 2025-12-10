/**
 * Cursor loader registry for feature installation
 * Singleton registry that manages all Cursor feature loaders
 */

import { cursorProfilesLoader } from "@/cli/features/cursor/profiles/loader.js";

import type { Loader } from "@/cli/features/loaderRegistry.js";

/**
 * Registry singleton for managing Cursor feature loaders
 */
export class CursorLoaderRegistry {
  private static instance: CursorLoaderRegistry | null = null;
  private loaders: Map<string, Loader>;

  private constructor() {
    this.loaders = new Map();

    // Register all Cursor loaders
    // For now, only profiles loader is registered
    // Additional loaders can be added here as needed
    this.loaders.set(cursorProfilesLoader.name, cursorProfilesLoader);
  }

  /**
   * Get the singleton instance
   * @returns The CursorLoaderRegistry singleton instance
   */
  public static getInstance(): CursorLoaderRegistry {
    if (CursorLoaderRegistry.instance == null) {
      CursorLoaderRegistry.instance = new CursorLoaderRegistry();
    }
    return CursorLoaderRegistry.instance;
  }

  /**
   * Get all registered loaders
   * @returns Array of all loaders
   */
  public getAll(): Array<Loader> {
    return Array.from(this.loaders.values());
  }

  /**
   * Get all registered loaders in reverse order (for uninstall)
   * @returns Array of all loaders in reverse order
   */
  public getAllReversed(): Array<Loader> {
    return Array.from(this.loaders.values()).reverse();
  }
}
