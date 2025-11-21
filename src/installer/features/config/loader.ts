/**
 * Config file loader
 * Manages the .nori-config.json file lifecycle
 */

import { unlinkSync, existsSync } from "fs";

import { getConfigPath } from "@/installer/config.js";
import { info, success } from "@/installer/logger.js";

import type { Config } from "@/installer/config.js";
import type { Loader } from "@/installer/features/loaderRegistry.js";

/**
 * Install config file - no-op, config is managed by install.ts
 * @param args - Configuration arguments
 * @param args.config - Runtime configuration
 */
const installConfig = async (args: { config: Config }): Promise<void> => {
  const { config: _config } = args;
  // Config file creation is handled by install.ts via saveDiskConfig()
  // This loader only handles uninstall
};

/**
 * Uninstall config file - remove it
 * @param args - Configuration arguments
 * @param args.config - Runtime configuration
 */
const uninstallConfig = async (args: { config: Config }): Promise<void> => {
  const { config } = args;
  const configFile = getConfigPath({ installDir: config.installDir });

  if (existsSync(configFile)) {
    unlinkSync(configFile);
    success({ message: `✓ Config file removed: ${configFile}` });
  } else {
    info({ message: "Config file not found (may not exist)" });
  }
};

/**
 * Config loader
 */
export const configLoader: Loader = {
  name: "config",
  description: "Manage .nori-config.json file",
  run: installConfig,
  uninstall: uninstallConfig,
};
