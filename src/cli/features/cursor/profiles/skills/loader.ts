/**
 * Cursor skills feature loader
 * Installs skill configuration files to ~/.cursor/skills/
 */

import * as fs from "fs/promises";
import * as path from "path";

import { isPaidInstall, type Config } from "@/cli/config.js";
import {
  getCursorDir,
  getCursorSkillsDir,
  getCursorSettingsFile,
} from "@/cli/env.js";
import { success, info, warn } from "@/cli/logger.js";
import { substituteTemplatePaths } from "@/utils/template.js";

import type { CursorProfileLoader } from "@/cli/features/cursor/profiles/cursorProfileLoaderRegistry.js";
import type { ValidationResult } from "@/cli/features/loaderRegistry.js";

/**
 * Copy a directory recursively, applying template substitution to markdown files
 *
 * @param args - Copy arguments
 * @param args.src - Source directory path
 * @param args.dest - Destination directory path
 * @param args.installDir - Installation directory for template substitution
 */
const copyDirWithTemplateSubstitution = async (args: {
  src: string;
  dest: string;
  installDir: string;
}): Promise<void> => {
  const { src, dest, installDir } = args;

  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirWithTemplateSubstitution({
        src: srcPath,
        dest: destPath,
        installDir,
      });
    } else if (entry.name.endsWith(".md")) {
      // Apply template substitution to markdown files
      const content = await fs.readFile(srcPath, "utf-8");
      const substituted = substituteTemplatePaths({ content, installDir });
      await fs.writeFile(destPath, substituted);
    } else {
      // Copy other files directly
      await fs.copyFile(srcPath, destPath);
    }
  }
};

/**
 * Get config directory for skills based on selected profile
 *
 * @param args - Configuration arguments
 * @param args.profileName - Name of the profile to load skills from
 * @param args.installDir - Installation directory
 *
 * @returns Path to the skills config directory for the profile
 */
const getConfigDir = (args: {
  profileName: string;
  installDir: string;
}): string => {
  const { profileName, installDir } = args;
  const cursorDir = getCursorDir({ installDir });
  return path.join(cursorDir, "profiles", profileName, "skills");
};

/**
 * Install skills
 * @param args - Configuration arguments
 * @param args.config - Runtime configuration
 */
const installSkills = async (args: { config: Config }): Promise<void> => {
  const { config } = args;
  info({ message: "Installing Nori skills for Cursor..." });

  // Get profile name from config (default to senior-swe)
  const profileName = config.profile?.baseProfile || "senior-swe";
  const configDir = getConfigDir({
    profileName,
    installDir: config.installDir,
  });
  const cursorSkillsDir = getCursorSkillsDir({ installDir: config.installDir });

  // Remove existing skills directory if it exists
  await fs.rm(cursorSkillsDir, { recursive: true, force: true });

  // Create skills directory
  await fs.mkdir(cursorSkillsDir, { recursive: true });

  // Read all entries from config directory
  let entries;
  try {
    entries = await fs.readdir(configDir, { withFileTypes: true });
  } catch {
    // If config directory doesn't exist, just log and return
    info({ message: "No skills directory found in profile, skipping" });
    return;
  }

  for (const entry of entries) {
    const sourcePath = path.join(configDir, entry.name);

    if (!entry.isDirectory()) {
      // Copy non-directory files (like docs.md) with template substitution if markdown
      const destPath = path.join(cursorSkillsDir, entry.name);
      if (entry.name.endsWith(".md")) {
        const content = await fs.readFile(sourcePath, "utf-8");
        const substituted = substituteTemplatePaths({
          content,
          installDir: config.installDir,
        });
        await fs.writeFile(destPath, substituted);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
      continue;
    }

    // Handle paid-prefixed skills
    if (entry.name.startsWith("paid-")) {
      if (isPaidInstall({ config })) {
        // Strip paid- prefix when copying
        const destName = entry.name.replace(/^paid-/, "");
        const destPath = path.join(cursorSkillsDir, destName);
        await copyDirWithTemplateSubstitution({
          src: sourcePath,
          dest: destPath,
          installDir: config.installDir,
        });
      }
      // Skip if free tier
    } else {
      // Copy non-paid skills for all tiers
      const destPath = path.join(cursorSkillsDir, entry.name);
      await copyDirWithTemplateSubstitution({
        src: sourcePath,
        dest: destPath,
        installDir: config.installDir,
      });
    }
  }

  success({ message: "✓ Installed Cursor skills" });

  // Configure permissions for skills directory
  await configureSkillsPermissions({ config });
};

/**
 * Configure permissions for skills directory
 * Adds skills directory to permissions.additionalDirectories in settings.json
 *
 * @param args - Configuration arguments
 * @param args.config - Runtime configuration
 */
const configureSkillsPermissions = async (args: {
  config: Config;
}): Promise<void> => {
  const { config } = args;
  info({ message: "Configuring permissions for Cursor skills directory..." });

  const cursorSettingsFile = getCursorSettingsFile({
    installDir: config.installDir,
  });
  const cursorSkillsDir = getCursorSkillsDir({ installDir: config.installDir });

  // Create .cursor directory if it doesn't exist
  await fs.mkdir(path.dirname(cursorSettingsFile), { recursive: true });

  // Read or initialize settings
  let settings: Record<string, unknown> = {};
  try {
    const content = await fs.readFile(cursorSettingsFile, "utf-8");
    settings = JSON.parse(content);
  } catch {
    settings = {
      $schema: "https://json.schemastore.org/claude-code-settings.json",
    };
  }

  // Initialize permissions object if needed
  if (!settings.permissions) {
    settings.permissions = {};
  }

  const permissions = settings.permissions as Record<string, unknown>;

  // Initialize additionalDirectories array if needed
  if (!permissions.additionalDirectories) {
    permissions.additionalDirectories = [];
  }

  const additionalDirectories =
    permissions.additionalDirectories as Array<string>;

  // Add skills directory if not already present
  if (!additionalDirectories.includes(cursorSkillsDir)) {
    additionalDirectories.push(cursorSkillsDir);
  }

  // Write back to file
  await fs.writeFile(cursorSettingsFile, JSON.stringify(settings, null, 2));
  success({ message: `✓ Configured permissions for ${cursorSkillsDir}` });
};

/**
 * Uninstall skills
 *
 * @param args - Configuration arguments
 * @param args.config - Runtime configuration
 */
const uninstallSkills = async (args: { config: Config }): Promise<void> => {
  const { config } = args;
  info({ message: "Removing Nori skills from Cursor..." });

  const cursorSkillsDir = getCursorSkillsDir({ installDir: config.installDir });

  try {
    await fs.access(cursorSkillsDir);
    await fs.rm(cursorSkillsDir, { recursive: true, force: true });
    success({ message: "✓ Removed Cursor skills directory" });
  } catch {
    info({
      message: "Skills directory not found (may not have been installed)",
    });
  }

  // Remove permissions configuration
  await removeSkillsPermissions({ config });
};

/**
 * Remove skills directory permissions
 * Removes skills directory from permissions.additionalDirectories in settings.json
 *
 * @param args - Configuration arguments
 * @param args.config - Runtime configuration
 */
const removeSkillsPermissions = async (args: {
  config: Config;
}): Promise<void> => {
  const { config } = args;
  info({ message: "Removing Cursor skills directory permissions..." });

  const cursorSettingsFile = getCursorSettingsFile({
    installDir: config.installDir,
  });
  const cursorSkillsDir = getCursorSkillsDir({ installDir: config.installDir });

  try {
    const content = await fs.readFile(cursorSettingsFile, "utf-8");
    const settings = JSON.parse(content);

    if (settings.permissions?.additionalDirectories) {
      settings.permissions.additionalDirectories =
        settings.permissions.additionalDirectories.filter(
          (dir: string) => dir !== cursorSkillsDir,
        );

      // Clean up empty arrays/objects
      if (settings.permissions.additionalDirectories.length === 0) {
        delete settings.permissions.additionalDirectories;
      }
      if (Object.keys(settings.permissions).length === 0) {
        delete settings.permissions;
      }

      await fs.writeFile(cursorSettingsFile, JSON.stringify(settings, null, 2));
      success({ message: "✓ Removed Cursor skills directory permissions" });
    } else {
      info({ message: "No permissions found in settings.json" });
    }
  } catch (err) {
    warn({ message: `Could not remove permissions: ${err}` });
  }
};

/**
 * Validate skills installation
 * @param args - Configuration arguments
 * @param args.config - Runtime configuration
 *
 * @returns Validation result
 */
const validate = async (args: {
  config: Config;
}): Promise<ValidationResult> => {
  const { config } = args;
  const errors: Array<string> = [];

  const cursorSkillsDir = getCursorSkillsDir({ installDir: config.installDir });
  const cursorSettingsFile = getCursorSettingsFile({
    installDir: config.installDir,
  });

  // Check if skills directory exists
  try {
    await fs.access(cursorSkillsDir);
  } catch {
    errors.push(`Skills directory not found at ${cursorSkillsDir}`);
    errors.push('Run "nori-ai install-cursor" to install skills');
    return {
      valid: false,
      message: "Cursor skills directory not found",
      errors,
    };
  }

  // Check if permissions are configured in settings.json
  try {
    const content = await fs.readFile(cursorSettingsFile, "utf-8");
    const settings = JSON.parse(content);

    if (
      !settings.permissions?.additionalDirectories?.includes(cursorSkillsDir)
    ) {
      errors.push(
        "Skills directory not configured in permissions.additionalDirectories",
      );
      errors.push('Run "nori-ai install-cursor" to configure permissions');
      return {
        valid: false,
        message: "Cursor skills permissions not configured",
        errors,
      };
    }
  } catch {
    errors.push("Could not read or parse Cursor settings.json");
    return {
      valid: false,
      message: "Cursor settings file error",
      errors,
    };
  }

  return {
    valid: true,
    message: "Cursor skills are properly installed",
    errors: null,
  };
};

/**
 * Cursor skills feature loader
 */
export const cursorSkillsLoader: CursorProfileLoader = {
  name: "cursor-skills",
  description: "Install skill configuration files for Cursor",
  install: async (args: { config: Config }) => {
    const { config } = args;
    await installSkills({ config });
  },
  uninstall: async (args: { config: Config }) => {
    const { config } = args;
    await uninstallSkills({ config });
  },
  validate,
};
