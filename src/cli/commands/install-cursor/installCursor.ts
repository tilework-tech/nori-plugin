/**
 * install-cursor CLI command
 * Installs Nori profiles and features for Cursor IDE
 */

import * as os from "os";

import { CursorLoaderRegistry } from "@/cli/features/cursor/cursorLoaderRegistry.js";
import { info, success } from "@/cli/logger.js";

import type { Config } from "@/cli/config.js";
import type { Command } from "commander";

/**
 * Main function for install-cursor command
 *
 * @returns Promise that resolves when command completes
 */
export const installCursorMain = async (): Promise<void> => {
  info({ message: "Installing Nori for Cursor IDE..." });

  // Create a default config for Cursor installation
  const config: Config = {
    installDir: os.homedir(),
  };

  // Get all Cursor loaders and execute them
  const registry = CursorLoaderRegistry.getInstance();
  const loaders = registry.getAll();

  for (const loader of loaders) {
    info({ message: `Running ${loader.name}...` });
    await loader.run({ config });
  }

  success({ message: "✓ Nori installed for Cursor IDE" });
};

/**
 * Register the install-cursor command with Commander
 * @param args - Arguments object
 * @param args.program - Commander program instance
 */
export const registerInstallCursorCommand = (args: {
  program: Command;
}): void => {
  const { program } = args;

  program
    .command("install-cursor")
    .description("Install Nori for Cursor IDE")
    .action(async () => {
      await installCursorMain();
    });
};
