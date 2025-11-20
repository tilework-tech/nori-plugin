/**
 * Version tracking utilities for Nori Profiles installer
 *
 * Manages version tracking to ensure proper uninstallation of previous versions
 * before installing new versions.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { getConfigPath } from "@/installer/config.js";
import { MCP_ROOT } from "@/installer/env.js";

const DEFAULT_VERSION = "12.1.0";

/**
 * Get the path to the version file
 *
 * @param args - Configuration arguments
 * @param args.installDir - Custom installation directory (optional)
 *
 * @returns The absolute path to .nori-installed-version
 */
export const getVersionFilePath = (args?: {
  installDir?: string | null;
}): string => {
  const { installDir } = args || {};

  if (installDir != null && installDir !== "") {
    return join(installDir, ".nori-installed-version");
  }

  // Default: use current working directory
  return join(process.cwd(), ".nori-installed-version");
};

/**
 * Check if there's an existing installation
 * An installation exists if:
 * - Version file exists at ~/.nori-installed-version
 * - OR config file exists at <installDir>/.nori-config.json (or cwd if not specified)
 *
 * @param args - Configuration arguments
 * @param args.installDir - Custom installation directory (optional)
 *
 * @returns true if an installation exists, false otherwise
 */
export const hasExistingInstallation = (args?: {
  installDir?: string | null;
}): boolean => {
  const { installDir } = args || {};
  const versionFileExists = existsSync(getVersionFilePath());
  const configFileExists = existsSync(getConfigPath({ installDir }));
  return versionFileExists || configFileExists;
};

/**
 * Get the current package version by reading package.json
 * This works for any installation method (global npm, npx, local node_modules)
 * @returns The current package version or null if not found
 */
export const getCurrentPackageVersion = (): string | null => {
  try {
    const packageJsonPath = join(MCP_ROOT, "package.json");
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    // Verify it's the nori-ai package
    if (pkg.name === "nori-ai") {
      return pkg.version;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Get the installed version from .nori-installed-version
 * Defaults to 12.1.0 if file does not exist (assumes existing installations are 12.1.0)
 *
 * @param args - Configuration arguments
 * @param args.installDir - Custom installation directory (optional)
 *
 * @returns The installed version string
 */
export const getInstalledVersion = (args?: {
  installDir?: string | null;
}): string => {
  const { installDir } = args || {};
  try {
    const version = readFileSync(
      getVersionFilePath({ installDir }),
      "utf-8",
    ).trim();
    if (version) {
      return version;
    }
    return DEFAULT_VERSION;
  } catch {
    // File doesn't exist or can't be read - default to 12.1.0
    return DEFAULT_VERSION;
  }
};

/**
 * Save the installed version to .nori-installed-version
 * @param args - Configuration arguments
 * @param args.version - Version to save
 * @param args.installDir - Custom installation directory (optional)
 */
export const saveInstalledVersion = (args: {
  version: string;
  installDir?: string | null;
}): void => {
  const { version, installDir } = args;
  writeFileSync(getVersionFilePath({ installDir }), version, "utf-8");
};
