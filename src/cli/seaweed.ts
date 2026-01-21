#!/usr/bin/env node

/**
 * Seaweed CLI - Registry Operations
 *
 * A minimal CLI focused on registry operations only.
 * For full Nori Profiles functionality, use the nori-ai CLI.
 */

import { Command } from "commander";

import { registerRegistryDownloadCommand } from "@/cli/commands/registry-download/registryDownload.js";
import { registerRegistryInstallCommand } from "@/cli/commands/registry-install/registryInstall.js";
import { registerRegistrySearchCommand } from "@/cli/commands/registry-search/registrySearch.js";
import { registerRegistryUpdateCommand } from "@/cli/commands/registry-update/registryUpdate.js";
import { registerRegistryUploadCommand } from "@/cli/commands/registry-upload/registryUpload.js";
import { getCurrentPackageVersion } from "@/cli/version.js";
import { normalizeInstallDir } from "@/utils/path.js";

const program = new Command();
const version = getCurrentPackageVersion() || "unknown";

program
  .name("seaweed")
  .version(version)
  .description(`Seaweed CLI - Registry Operations v${version}`)
  .option(
    "-d, --install-dir <path>",
    "Custom installation directory (default: ~/.claude)",
    (value) => normalizeInstallDir({ installDir: value }),
  )
  .option("-n, --non-interactive", "Run without interactive prompts")
  .option("-s, --silent", "Suppress all output (implies --non-interactive)")
  .option(
    "-a, --agent <name>",
    "AI agent to use (auto-detected from config, or claude-code)",
  )
  .addHelpText(
    "after",
    `
Examples:
  $ seaweed registry-search typescript
  $ seaweed registry-download my-profile
  $ seaweed registry-download my-profile@1.0.0
  $ seaweed registry-download my-profile --list-versions
  $ seaweed registry-install my-profile
  $ seaweed registry-install my-profile --user
  $ seaweed registry-update my-profile
  $ seaweed registry-upload my-profile
  $ seaweed registry-upload my-profile@1.0.0 --registry https://registry.example.com
`,
  );

// Register only registry commands
registerRegistrySearchCommand({ program });
registerRegistryDownloadCommand({ program });
registerRegistryInstallCommand({ program });
registerRegistryUpdateCommand({ program });
registerRegistryUploadCommand({ program });

program.parse(process.argv);

// Show help if no command provided
if (process.argv.length < 3) {
  program.help();
}
