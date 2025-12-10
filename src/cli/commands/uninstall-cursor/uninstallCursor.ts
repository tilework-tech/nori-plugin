/**
 * uninstall-cursor CLI command
 * Uninstalls Nori profiles and features from Cursor IDE
 */

import * as os from "os";

import { CursorLoaderRegistry } from "@/cli/features/cursor/cursorLoaderRegistry.js";
import { info, success } from "@/cli/logger.js";

import type { Config } from "@/cli/config.js";
import type { Command } from "commander";

/**
 * Main function for uninstall-cursor command
 *
 * @returns Promise that resolves when command completes
 */
export const uninstallCursorMain = async (): Promise<void> => {
  info({ message: "Uninstalling Nori from Cursor IDE..." });

  // Create a default config for Cursor uninstallation
  const config: Config = {
    installDir: os.homedir(),
  };

  // Get all Cursor loaders in reverse order and execute their uninstall
  const registry = CursorLoaderRegistry.getInstance();
  const loaders = registry.getAllReversed();

  for (const loader of loaders) {
    info({ message: `Running ${loader.name} uninstall...` });
    await loader.uninstall({ config });
  }

  success({ message: "✓ Nori uninstalled from Cursor IDE" });
  info({ message: "Please restart Cursor for changes to take effect." });
};

/**
 * Register the uninstall-cursor command with Commander
 * @param args - Arguments object
 * @param args.program - Commander program instance
 */
export const registerUninstallCursorCommand = (args: {
  program: Command;
}): void => {
  const { program } = args;

  program
    .command("uninstall-cursor")
    .description("Uninstall Nori from Cursor IDE")
    .action(async () => {
      await uninstallCursorMain();
    });
};
