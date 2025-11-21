/**
 * Version file loader
 * Manages the .nori-installed-version file lifecycle
 */

import { unlinkSync, existsSync } from "fs";

import { info, success } from "@/installer/logger.js";
import {
  getCurrentPackageVersion,
  saveInstalledVersion,
  getVersionFilePath,
} from "@/installer/version.js";

import type { Config } from "@/installer/config.js";
import type { Loader } from "@/installer/features/loaderRegistry.js";

/**
 * Install version file - save current package version
 * @param args - Configuration arguments
 * @param args.config - Runtime configuration
 */
const installVersion = async (args: { config: Config }): Promise<void> => {
  const { config } = args;

  const currentVersion = getCurrentPackageVersion();
  if (currentVersion == null) {
    info({
      message: "Could not determine package version, skipping version file",
    });
    return;
  }

  saveInstalledVersion({
    version: currentVersion,
    installDir: config.installDir,
  });

  success({
    message: `✓ Version file created: ${getVersionFilePath({ installDir: config.installDir })}`,
  });
};

/**
 * Uninstall version file - remove it
 * @param args - Configuration arguments
 * @param args.config - Runtime configuration
 */
const uninstallVersion = async (args: { config: Config }): Promise<void> => {
  const { config } = args;
  const versionFile = getVersionFilePath({ installDir: config.installDir });

  if (existsSync(versionFile)) {
    unlinkSync(versionFile);
    success({ message: `✓ Version file removed: ${versionFile}` });
  } else {
    info({ message: "Version file not found (may not exist)" });
  }
};

/**
 * Version loader
 */
export const versionLoader: Loader = {
  name: "version",
  description: "Manage .nori-installed-version file",
  run: installVersion,
  uninstall: uninstallVersion,
};
