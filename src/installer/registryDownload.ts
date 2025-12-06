/**
 * CLI command for downloading profiles from the Nori profile registry
 * Handles: nori-ai registry-download <profile>[@version] [--registry <url>]
 */

import * as fs from "fs/promises";
import * as path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import zlib from "zlib";

import * as tar from "tar";

import {
  profileRegistryApi,
  PROFILE_REGISTRY_URL,
} from "@/api/profileRegistry.js";
import { getRegistryAuthToken } from "@/api/registryAuth.js";
import { loadConfig, getRegistryAuth } from "@/installer/config.js";
import { error, success, info } from "@/installer/logger.js";
import { getInstallDirs } from "@/utils/path.js";

import type { ProfileMetadata } from "@/api/profileRegistry.js";
import type { Config } from "@/installer/config.js";
import type { Command } from "commander";

/**
 * Parse profile name and optional version from profile spec
 * Supports formats: "profile-name" or "profile-name@1.0.0"
 * @param args - The parsing parameters
 * @param args.profileSpec - Profile specification string
 *
 * @returns Parsed profile name and optional version
 */
const parseProfileSpec = (args: {
  profileSpec: string;
}): { profileName: string; version?: string | null } => {
  const { profileSpec } = args;
  const match = profileSpec.match(/^([a-z0-9-]+)(?:@(\d+\.\d+\.\d+.*))?$/i);

  if (!match) {
    return { profileName: profileSpec, version: null };
  }

  return {
    profileName: match[1],
    version: match[2] ?? null,
  };
};

/**
 * Check if buffer starts with gzip magic bytes (0x1f 0x8b)
 * @param args - The check parameters
 * @param args.buffer - The buffer to check
 *
 * @returns True if the buffer is gzip compressed
 */
const isGzipped = (args: { buffer: Buffer }): boolean => {
  const { buffer } = args;
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
};

/**
 * Extract a tarball to a directory
 * @param args - The extraction parameters
 * @param args.tarballData - The tarball data as ArrayBuffer
 * @param args.targetDir - The directory to extract to
 */
const extractTarball = async (args: {
  tarballData: ArrayBuffer;
  targetDir: string;
}): Promise<void> => {
  const { tarballData, targetDir } = args;

  const buffer = Buffer.from(tarballData);
  const readable = Readable.from(buffer);

  if (isGzipped({ buffer })) {
    await pipeline(
      readable,
      zlib.createGunzip(),
      tar.extract({ cwd: targetDir }),
    );
  } else {
    await pipeline(readable, tar.extract({ cwd: targetDir }));
  }
};

/**
 * Result of searching for a profile in a registry
 */
type RegistrySearchResult = {
  registryUrl: string;
  profileMetadata: ProfileMetadata;
  authToken?: string | null;
};

/**
 * Search all registries for a profile
 * Public registry is searched without auth, private registries require auth
 * @param args - The search parameters
 * @param args.profileName - The profile name to search for
 * @param args.config - The Nori configuration containing registry auth
 *
 * @returns Array of registries where the profile was found
 */
const searchAllRegistries = async (args: {
  profileName: string;
  config: Config | null;
}): Promise<Array<RegistrySearchResult>> => {
  const { profileName, config } = args;
  const results: Array<RegistrySearchResult> = [];

  // Search public registry first (no auth needed)
  try {
    const profileMetadata = await profileRegistryApi.getProfileMetadata({
      profileName,
      registryUrl: PROFILE_REGISTRY_URL,
    });
    results.push({
      registryUrl: PROFILE_REGISTRY_URL,
      profileMetadata,
    });
  } catch {
    // Profile not found in public registry - continue to private registries
  }

  // Search private registries from config (auth required)
  if (config?.registryAuths != null) {
    for (const registryAuth of config.registryAuths) {
      try {
        // Get auth token for this registry
        const authToken = await getRegistryAuthToken({ registryAuth });

        const profileMetadata = await profileRegistryApi.getProfileMetadata({
          profileName,
          registryUrl: registryAuth.registryUrl,
          authToken,
        });

        results.push({
          registryUrl: registryAuth.registryUrl,
          profileMetadata,
          authToken,
        });
      } catch {
        // Profile not found or auth failed for this registry - continue
      }
    }
  }

  return results;
};

/**
 * Search a specific registry for a profile
 * @param args - The search parameters
 * @param args.profileName - The profile name to search for
 * @param args.registryUrl - The registry URL to search
 * @param args.config - The Nori configuration containing registry auth
 *
 * @returns The search result or null if not found or no auth configured
 */
const searchSpecificRegistry = async (args: {
  profileName: string;
  registryUrl: string;
  config: Config | null;
}): Promise<RegistrySearchResult | null> => {
  const { profileName, registryUrl, config } = args;

  // Check if this is the public registry
  if (registryUrl === PROFILE_REGISTRY_URL) {
    try {
      const profileMetadata = await profileRegistryApi.getProfileMetadata({
        profileName,
        registryUrl: PROFILE_REGISTRY_URL,
      });
      return {
        registryUrl: PROFILE_REGISTRY_URL,
        profileMetadata,
      };
    } catch {
      return null;
    }
  }

  // Private registry - require auth from config
  if (config == null) {
    return null;
  }

  const registryAuth = getRegistryAuth({ config, registryUrl });
  if (registryAuth == null) {
    return null;
  }

  try {
    const authToken = await getRegistryAuthToken({ registryAuth });
    const profileMetadata = await profileRegistryApi.getProfileMetadata({
      profileName,
      registryUrl,
      authToken,
    });
    return {
      registryUrl,
      profileMetadata,
      authToken,
    };
  } catch {
    return null;
  }
};

/**
 * Format the multiple profiles found error message
 * @param args - The format parameters
 * @param args.profileName - The profile name that was searched
 * @param args.results - The search results from multiple registries
 *
 * @returns Formatted error message
 */
const formatMultipleProfilesError = (args: {
  profileName: string;
  results: Array<RegistrySearchResult>;
}): string => {
  const { profileName, results } = args;

  const lines = ["Multiple profiles with the same name found.\n"];

  for (const result of results) {
    const version = result.profileMetadata["dist-tags"].latest ?? "unknown";
    const description = result.profileMetadata.description ?? "";
    lines.push(result.registryUrl);
    lines.push(`  -> ${profileName}@${version}: ${description}\n`);
  }

  lines.push("To download, please specify the registry with --registry:");
  for (const result of results) {
    lines.push(
      `nori-ai registry-download ${profileName} --registry ${result.registryUrl}`,
    );
  }

  return lines.join("\n");
};

/**
 * Download and install a profile from the registry
 * @param args - The download parameters
 * @param args.profileSpec - Profile name with optional version (e.g., "my-profile" or "my-profile@1.0.0")
 * @param args.cwd - Current working directory (defaults to process.cwd())
 * @param args.installDir - Optional explicit install directory
 * @param args.registryUrl - Optional registry URL to download from
 */
export const registryDownloadMain = async (args: {
  profileSpec: string;
  cwd?: string | null;
  installDir?: string | null;
  registryUrl?: string | null;
}): Promise<void> => {
  const { profileSpec, installDir, registryUrl } = args;
  const cwd = args.cwd ?? process.cwd();

  const { profileName, version } = parseProfileSpec({ profileSpec });

  // Find installation directory
  let targetInstallDir: string;

  if (installDir != null) {
    targetInstallDir = installDir;
  } else {
    const allInstallations = getInstallDirs({ currentDir: cwd });

    if (allInstallations.length === 0) {
      error({
        message: "No Nori installation found.",
      });
      info({
        message: "Run 'npx nori-ai install' to install Nori Profiles.",
      });
      return;
    }

    if (allInstallations.length > 1) {
      const installList = allInstallations
        .map((dir, index) => `${index + 1}. ${dir}`)
        .join("\n");

      error({
        message: `Found multiple Nori installations. Cannot determine which one to use.\n\nInstallations found:\n${installList}\n\nPlease use --install-dir to specify the target installation.`,
      });
      return;
    }

    targetInstallDir = allInstallations[0];
  }

  const profilesDir = path.join(targetInstallDir, ".claude", "profiles");
  const targetDir = path.join(profilesDir, profileName);

  // Check if profile already exists
  try {
    await fs.access(targetDir);
    error({
      message: `Profile "${profileName}" already exists at:\n${targetDir}\n\nTo reinstall, first remove the existing profile directory.`,
    });
    return;
  } catch {
    // Directory doesn't exist - continue
  }

  // Load config to get registry authentication
  const config = await loadConfig({ installDir: targetInstallDir });

  // Search for the profile
  let searchResults: Array<RegistrySearchResult>;

  if (registryUrl != null) {
    // User specified a specific registry
    // Check if private registry requires auth
    if (registryUrl !== PROFILE_REGISTRY_URL) {
      const registryAuth =
        config != null ? getRegistryAuth({ config, registryUrl }) : null;
      if (registryAuth == null) {
        error({
          message: `No authentication configured for registry: ${registryUrl}\n\nAdd registry credentials to your .nori-config.json file.`,
        });
        return;
      }
    }

    const result = await searchSpecificRegistry({
      profileName,
      registryUrl,
      config,
    });
    searchResults = result != null ? [result] : [];
  } else {
    // Search all registries
    searchResults = await searchAllRegistries({ profileName, config });
  }

  // Handle search results
  if (searchResults.length === 0) {
    error({
      message: `Profile "${profileName}" not found in any registry.`,
    });
    return;
  }

  if (searchResults.length > 1) {
    error({
      message: formatMultipleProfilesError({
        profileName,
        results: searchResults,
      }),
    });
    return;
  }

  // Single result - download from that registry
  const selectedRegistry = searchResults[0];

  // Download and extract the tarball
  try {
    info({ message: `Downloading profile "${profileName}"...` });

    const tarballData = await profileRegistryApi.downloadTarball({
      profileName,
      version: version ?? undefined,
      registryUrl: selectedRegistry.registryUrl,
      authToken: selectedRegistry.authToken ?? undefined,
    });

    // Create target directory
    await fs.mkdir(targetDir, { recursive: true });

    try {
      await extractTarball({ tarballData, targetDir });
    } catch (extractErr) {
      // Clean up on extraction failure
      await fs.rm(targetDir, { recursive: true, force: true });
      throw extractErr;
    }

    const versionStr = version ? `@${version}` : " (latest)";
    console.log("");
    success({
      message: `Downloaded and installed profile "${profileName}"${versionStr}`,
    });
    info({ message: `Installed to: ${targetDir}` });
    console.log("");
    info({
      message: `You can now use this profile with 'nori-ai switch-profile ${profileName}'.`,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error({
      message: `Failed to download profile "${profileName}": ${errorMessage}`,
    });
  }
};

/**
 * Register the 'registry-download' command with commander
 * @param args - Configuration arguments
 * @param args.program - Commander program instance
 */
export const registerRegistryDownloadCommand = (args: {
  program: Command;
}): void => {
  const { program } = args;

  program
    .command("registry-download <profile>")
    .description(
      "Download and install a profile from the Nori profile registry",
    )
    .option(
      "--registry <url>",
      "Download from a specific registry URL instead of searching all registries",
    )
    .action(async (profileSpec: string, options: { registry?: string }) => {
      const globalOpts = program.opts();

      await registryDownloadMain({
        profileSpec,
        installDir: globalOpts.installDir || null,
        registryUrl: options.registry || null,
      });
    });
};
