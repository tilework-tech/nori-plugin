/**
 * Config migration system for Nori Profiles
 *
 * Handles versioned migrations to transform config from old formats to new formats.
 * Migrations are applied in semver order during installation.
 */

import * as fs from "fs/promises";
import * as path from "path";

import semver from "semver";

import type { Config } from "@/cli/config.js";

/**
 * Migration definition type
 */
export type Migration = {
  version: string;
  name: string;
  migrate: (args: {
    config: Record<string, unknown>;
    installDir: string;
  }) => Promise<Record<string, unknown>>;
};

/**
 * Migration 19.0.0: Consolidate flat auth fields and legacy profile
 *
 * Auth migration:
 * Before: { username, password, organizationUrl, refreshToken, ... }
 * After: { auth: { username, password, organizationUrl, refreshToken }, ... }
 *
 * Profile migration:
 * Before: { profile: { baseProfile: "..." }, ... }
 * After: { agents: { "claude-code": { profile: { baseProfile: "..." } } }, ... }
 */
const migration_19_0_0: Migration = {
  version: "19.0.0",
  name: "consolidate-auth-and-profile-structure",
  migrate: async (args: {
    config: Record<string, unknown>;
    installDir: string;
  }): Promise<Record<string, unknown>> => {
    const { config } = args;
    const result = { ...config };

    // --- Auth Migration ---
    // If config already has nested auth, skip auth migration (idempotent)
    if (result.auth == null) {
      // Check if we have flat auth fields
      const username = result.username as string | undefined;
      const password = result.password as string | undefined;
      const refreshToken = result.refreshToken as string | undefined;
      const organizationUrl = result.organizationUrl as string | undefined;

      // Only create nested auth if we have complete auth data
      // (username + organizationUrl + (password or refreshToken))
      const hasAuth =
        username != null &&
        organizationUrl != null &&
        (password != null || refreshToken != null);

      if (hasAuth) {
        result.auth = {
          username,
          password: password ?? null,
          refreshToken: refreshToken ?? null,
          organizationUrl,
        };
      }

      // Remove flat auth fields regardless (clean up partial data too)
      delete result.username;
      delete result.password;
      delete result.refreshToken;
      delete result.organizationUrl;
    }

    // --- Profile Migration ---
    // Migrate legacy profile field to agents.claude-code.profile
    const legacyProfile = result.profile as
      | { baseProfile: string }
      | undefined
      | null;

    if (legacyProfile != null) {
      // Get or create agents object
      const agents = (result.agents as Record<string, unknown>) ?? {};

      // Only add claude-code profile if it doesn't already exist
      if (agents["claude-code"] == null) {
        agents["claude-code"] = { profile: legacyProfile };
      }

      result.agents = agents;

      // Remove legacy profile field
      delete result.profile;
    }

    // Update version
    result.version = "19.0.0";

    return result;
  },
};

/**
 * Recursively copy a directory
 * @param args - Copy arguments
 * @param args.src - Source directory path
 * @param args.dest - Destination directory path
 */
const copyDir = async (args: { src: string; dest: string }): Promise<void> => {
  const { src, dest } = args;
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir({ src: srcPath, dest: destPath });
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
};

/**
 * Migration 20.0.0: Move profiles from .claude/profiles to .nori/profiles
 *
 * This migration copies all existing profiles to the new location before
 * removing the old directory. This preserves any custom profiles or
 * user modifications to built-in profiles.
 */
const migration_20_0_0: Migration = {
  version: "20.0.0",
  name: "move-profiles-to-nori-directory",
  migrate: async (args: {
    config: Record<string, unknown>;
    installDir: string;
  }): Promise<Record<string, unknown>> => {
    const { config, installDir } = args;
    const result = { ...config };

    const oldProfilesDir = path.join(installDir, ".claude", "profiles");
    const newProfilesDir = path.join(installDir, ".nori", "profiles");

    // Check if old profiles directory exists
    try {
      await fs.access(oldProfilesDir);
    } catch {
      // Old directory doesn't exist, nothing to migrate
      result.version = "20.0.0";
      return result;
    }

    // Copy all profiles from old location to new location
    try {
      const profiles = await fs.readdir(oldProfilesDir, {
        withFileTypes: true,
      });

      for (const profile of profiles) {
        if (profile.isDirectory()) {
          const srcProfile = path.join(oldProfilesDir, profile.name);
          const destProfile = path.join(newProfilesDir, profile.name);

          // Copy profile to new location (will be overwritten by loader if built-in)
          await copyDir({ src: srcProfile, dest: destProfile });
        }
      }
    } catch {
      // Ignore copy errors - proceed with cleanup
    }

    // Remove old .claude/profiles directory
    try {
      await fs.rm(oldProfilesDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }

    // Clean up additionalDirectories in settings.json to remove old .claude/profiles path
    const settingsPath = path.join(installDir, ".claude", "settings.json");
    try {
      const settingsContent = await fs.readFile(settingsPath, "utf-8");
      const settings = JSON.parse(settingsContent);

      if (settings.permissions?.additionalDirectories) {
        // Remove any paths containing .claude/profiles
        settings.permissions.additionalDirectories =
          settings.permissions.additionalDirectories.filter(
            (dir: string) => !dir.includes(".claude/profiles"),
          );

        // Clean up empty additionalDirectories array
        if (settings.permissions.additionalDirectories.length === 0) {
          delete settings.permissions.additionalDirectories;
        }

        // Clean up empty permissions object
        if (Object.keys(settings.permissions).length === 0) {
          delete settings.permissions;
        }

        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
      }
    } catch {
      // Ignore errors - settings.json might not exist
    }

    // Update version
    result.version = "20.0.0";

    return result;
  },
};

/**
 * Ordered list of migrations
 * Each migration transforms config from the previous version to its version
 */
export const migrations: Array<Migration> = [
  migration_19_0_0,
  migration_20_0_0,
];

/**
 * Apply all applicable migrations to a config
 *
 * @param args - Migration arguments
 * @param args.previousVersion - The version the config is currently at
 * @param args.config - The config to migrate
 * @param args.installDir - Installation directory for file system operations
 *
 * @throws Error if previousVersion is null, undefined, empty, or invalid semver
 *
 * @returns The migrated config
 */
export const migrate = async (args: {
  previousVersion: string;
  config: Record<string, unknown>;
  installDir: string;
}): Promise<Config> => {
  const { previousVersion, config, installDir } = args;

  // Validate previousVersion
  if (previousVersion == null || previousVersion === "") {
    throw new Error("previousVersion is required");
  }

  if (semver.valid(previousVersion) == null) {
    throw new Error(`Invalid previousVersion: ${previousVersion}`);
  }

  // Sort migrations by semver (should already be sorted, but be safe)
  const sortedMigrations = [...migrations].sort((a, b) =>
    semver.compare(a.version, b.version),
  );

  // Apply migrations in order
  let result = { ...config };

  for (const migration of sortedMigrations) {
    // Skip migrations for versions <= previousVersion
    if (semver.lte(migration.version, previousVersion)) {
      continue;
    }

    // Apply migration
    result = await migration.migrate({ config: result, installDir });
  }

  return result as Config;
};
