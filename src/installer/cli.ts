#!/usr/bin/env node

/**
 * Nori Profiles CLI Router
 *
 * Routes commands to the appropriate installer/uninstaller.
 */

import { handshake } from "@/api/index.js";
import {
  loadDiskConfig,
  generateConfig,
  validateDiskConfig,
} from "@/installer/config.js";
import { LoaderRegistry } from "@/installer/features/loaderRegistry.js";
import { main as installMain } from "@/installer/install.js";
import { error, success, info, warn } from "@/installer/logger.js";
import { switchProfile } from "@/installer/profiles.js";
import { main as uninstallMain } from "@/installer/uninstall.js";
import { normalizeInstallDir } from "@/utils/path.js";

const showHelp = (args?: { command?: string | null }): void => {
  const { command } = args || {};

  if (command === "install") {
    console.log("Usage: nori-ai install [options]");
    console.log("");
    console.log("Install Nori Profiles to your system");
    console.log("");
    console.log("Options:");
    console.log(
      "  --install-dir <path> Install to custom directory (default: ~/.claude)",
    );
    console.log("  --non-interactive    Run without prompts");
    return;
  }

  if (command === "uninstall") {
    console.log("Usage: nori-ai uninstall [options]");
    console.log("");
    console.log("Uninstall Nori Profiles from your system");
    console.log("");
    console.log("Options:");
    console.log(
      "  --install-dir <path> Uninstall from custom directory (default: ~/.claude)",
    );
    console.log("  --non-interactive    Run without prompts");
    return;
  }

  if (command === "check") {
    console.log("Usage: nori-ai check [options]");
    console.log("");
    console.log("Validate Nori installation and configuration");
    console.log("");
    console.log("Options:");
    console.log(
      "  --install-dir <path> Check installation in custom directory (default: ~/.claude)",
    );
    return;
  }

  if (command === "switch-profile") {
    console.log("Usage: nori-ai switch-profile <profile-name> [options]");
    console.log("");
    console.log("Switch to a different profile and reinstall");
    console.log("");
    console.log("Arguments:");
    console.log("  <profile-name>       Name of the profile to switch to");
    console.log("");
    console.log("Options:");
    console.log(
      "  --install-dir <path> Installation directory (default: ~/.claude)",
    );
    return;
  }

  // General help
  console.log("Usage: nori-ai [command] [options]");
  console.log("");
  console.log("Commands:");
  console.log("  install              Install Nori Profiles (default)");
  console.log("  uninstall            Uninstall Nori Profiles");
  console.log(
    "  check                Validate Nori installation and configuration",
  );
  console.log(
    "  switch-profile <name> Switch to a different profile and reinstall",
  );
  console.log("  help                 Show this help message");
  console.log("");
  console.log("Options:");
  console.log(
    "  --install-dir <path> Install to custom directory (default: ~/.claude)",
  );
  console.log("  --non-interactive    Run without prompts");
  console.log("");
  console.log(
    "Run 'nori-ai <command> --help' for more information on a command",
  );
};

/**
 * Run validation checks on Nori installation
 * This is a CLI entry point that accepts optional installDir
 * @param args - Configuration arguments
 * @param args.installDir - Custom installation directory (optional, defaults to cwd)
 */
const checkMain = async (args?: {
  installDir?: string | null;
}): Promise<void> => {
  // Normalize installDir at entry point
  const installDir = normalizeInstallDir({ installDir: args?.installDir });

  console.log("");
  info({ message: "Running Nori Profiles validation checks..." });
  console.log("");

  let hasErrors = false;

  // Check config
  info({ message: "Checking configuration..." });
  const configResult = await validateDiskConfig({ installDir });
  if (configResult.valid) {
    success({ message: `   ✓ ${configResult.message}` });
  } else {
    error({ message: `   ✗ ${configResult.message}` });
    if (configResult.errors) {
      for (const err of configResult.errors) {
        info({ message: `     - ${err}` });
      }
    }
    hasErrors = true;
  }
  console.log("");

  // Load config to determine install type
  const diskConfig = await loadDiskConfig({ installDir });
  const config = generateConfig({ diskConfig, installDir });

  // Check server connectivity (paid mode only)
  if (config.installType === "paid") {
    info({ message: "Testing server connection..." });
    try {
      const response = await handshake();
      success({
        message: `   ✓ Server authentication successful (user: ${response.user})`,
      });
    } catch (err: any) {
      error({ message: "   ✗ Server authentication failed" });
      info({ message: `     - ${err.message}` });
      hasErrors = true;
    }
    console.log("");
  }

  // Run validation for all loaders
  const registry = LoaderRegistry.getInstance();
  const loaders = registry.getAll();

  info({ message: "Checking feature installations..." });

  for (const loader of loaders) {
    if (loader.validate) {
      try {
        const result = await loader.validate({ config });
        if (result.valid) {
          success({ message: `   ✓ ${loader.name}: ${result.message}` });
        } else {
          error({ message: `   ✗ ${loader.name}: ${result.message}` });
          if (result.errors) {
            for (const err of result.errors) {
              info({ message: `     - ${err}` });
            }
          }
          hasErrors = true;
        }
      } catch (err: any) {
        error({ message: `   ✗ ${loader.name}: Validation failed` });
        info({ message: `     - ${err.message}` });
        hasErrors = true;
      }
    }
  }

  console.log("");
  console.log("=".repeat(70));

  if (hasErrors) {
    error({ message: "Validation completed with errors" });
    warn({ message: 'Run "nori-ai install" to fix installation issues' });
    process.exit(1);
  } else {
    success({ message: "All validation checks passed!" });
    info({ message: `Installation mode: ${config.installType}` });
  }
};

/**
 * Parse --install-dir <path> from args
 * @param args - Command line arguments
 *
 * @returns The install directory path or null
 */
const parseInstallDir = (args: Array<string>): string | null => {
  const index = args.indexOf("--install-dir");
  if (index === -1 || index === args.length - 1) {
    return null;
  }
  const rawPath = args[index + 1];
  // Normalize the path (handles ~, relative paths, and .claude suffix)
  return normalizeInstallDir({ installDir: rawPath });
};

/**
 * Validate arguments for a given command
 * @param args - Configuration arguments
 * @param args.command - The command being executed
 * @param args.commandArgs - Arguments passed to the command (excluding the command itself)
 *
 * @returns True if arguments are valid, false otherwise
 */
const validateCommandArgs = (args: {
  command: string;
  commandArgs: Array<string>;
}): boolean => {
  const { command, commandArgs } = args;
  const validOptions = new Set([
    "--help",
    "-h",
    "--install-dir",
    "--non-interactive",
  ]);

  // Filter out known options and their values
  const unknownArgs = commandArgs.filter((arg, index) => {
    // If this is a value for --install-dir, skip it
    if (index > 0 && commandArgs[index - 1] === "--install-dir") {
      return false;
    }
    // If this is a known option, skip it
    if (validOptions.has(arg)) {
      return false;
    }
    // For switch-profile, the first arg is the profile name
    if (command === "switch-profile" && index === 0 && !arg.startsWith("-")) {
      return false;
    }
    return true;
  });

  return unknownArgs.length === 0;
};

/**
 * Process CLI arguments and route to appropriate command
 * Exported for testing
 * @param args - Command line arguments (e.g., from process.argv.slice(2))
 */
export const processCli = async (args: Array<string>): Promise<void> => {
  const command = args[0] || "install";

  if (command === "help" || command === "--help" || command === "-h") {
    showHelp();
    return;
  }

  // Check for help flags anywhere in arguments
  if (args.includes("--help") || args.includes("-h")) {
    showHelp({ command });
    return;
  }

  // Check for --non-interactive flag
  const nonInteractive = args.includes("--non-interactive");

  // Check for --install-dir flag
  const installDir = parseInstallDir(args);

  if (command === "install") {
    // Validate arguments
    const commandArgs = args.slice(1);
    if (!validateCommandArgs({ command, commandArgs })) {
      error({ message: "Unrecognized arguments" });
      console.log("");
      showHelp({ command });
      process.exit(1);
    }

    await installMain({ nonInteractive, installDir });
    return;
  }

  if (command === "uninstall") {
    // Validate arguments
    const commandArgs = args.slice(1);
    if (!validateCommandArgs({ command, commandArgs })) {
      error({ message: "Unrecognized arguments" });
      console.log("");
      showHelp({ command });
      process.exit(1);
    }

    await uninstallMain({ nonInteractive, installDir });
    return;
  }

  if (command === "check") {
    await checkMain({ installDir });
    return;
  }

  if (command === "switch-profile") {
    const profileName = args[1];

    if (!profileName) {
      error({ message: "Profile name is required" });
      console.log("Usage: nori-ai switch-profile <profile-name>");
      process.exit(1);
    }

    // Switch to the profile
    await switchProfile({ profileName, installDir });

    // Run install in non-interactive mode with skipUninstall
    // This preserves custom user profiles during the profile switch
    info({ message: "Applying profile configuration..." });
    await installMain({
      nonInteractive: true,
      skipUninstall: true,
      installDir,
    });

    return;
  }

  error({ message: `Unknown command: ${command}` });
  console.log("");
  showHelp();
  process.exit(1);
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  await processCli(args);
};

main();
