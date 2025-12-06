/**
 * Intercepted slash command for downloading profiles
 * Handles /nori-registry-download <profile-name>[@version] [registry-url] command
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
import { getInstallDirs } from "@/utils/path.js";

import type {
  HookInput,
  HookOutput,
  InterceptedSlashCommand,
} from "./types.js";
import type { ProfileMetadata } from "@/api/profileRegistry.js";
import type { Config } from "@/installer/config.js";

import { formatError, formatSuccess } from "./format.js";

/**
 * Parse profile name, optional version, and optional registry URL from prompt
 * Supports formats:
 *   - "profile-name"
 *   - "profile-name@1.0.0"
 *   - "profile-name https://registry.url"
 *   - "profile-name@1.0.0 https://registry.url"
 * @param prompt - The user prompt to parse
 *
 * @returns Parsed profile spec or null if invalid
 */
const parseProfileSpec = (
  prompt: string,
): {
  profileName: string;
  version?: string | null;
  registryUrl?: string | null;
} | null => {
  const match = prompt
    .trim()
    .match(
      /^\/nori-registry-download\s+([a-z0-9-]+)(?:@(\d+\.\d+\.\d+.*))?(?:\s+(https?:\/\/\S+))?$/i,
    );

  if (!match) {
    return null;
  }

  return {
    profileName: match[1],
    version: match[2] ?? null,
    registryUrl: match[3] ?? null,
  };
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
 * Public registry is searched first, then private registries from config
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

  // Search private registries from config
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
 * @returns The search result or null if not found
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

  // Private registry - need auth
  // Handle null config by trying without auth
  if (config == null) {
    try {
      const profileMetadata = await profileRegistryApi.getProfileMetadata({
        profileName,
        registryUrl,
      });
      return {
        registryUrl,
        profileMetadata,
      };
    } catch {
      return null;
    }
  }

  const registryAuth = getRegistryAuth({ config, registryUrl });
  if (registryAuth == null) {
    // Try without auth anyway (registry might allow public reads)
    try {
      const profileMetadata = await profileRegistryApi.getProfileMetadata({
        profileName,
        registryUrl,
      });
      return {
        registryUrl,
        profileMetadata,
      };
    } catch {
      return null;
    }
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
 * Check if buffer starts with gzip magic bytes (0x1f 0x8b)
 * @param buffer - The buffer to check
 *
 * @returns True if the buffer is gzip compressed
 */
const isGzipped = (buffer: Buffer): boolean => {
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

  // Convert ArrayBuffer to Buffer
  const buffer = Buffer.from(tarballData);

  // Create a readable stream from the buffer
  const readable = Readable.from(buffer);

  // Extract using tar, with optional gzip decompression based on magic bytes
  if (isGzipped(buffer)) {
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

  lines.push("To download, please include the registry URL:");
  for (const result of results) {
    lines.push(`/nori-registry-download ${profileName} ${result.registryUrl}`);
  }

  return lines.join("\n");
};

/**
 * Run the nori-registry-download command
 * @param args - The function arguments
 * @param args.input - The hook input containing prompt and cwd
 *
 * @returns The hook output with download result, or null if not handled
 */
const run = async (args: { input: HookInput }): Promise<HookOutput | null> => {
  const { input } = args;
  const { prompt, cwd } = input;

  // Parse profile spec from prompt
  const profileSpec = parseProfileSpec(prompt);
  if (profileSpec == null) {
    return {
      decision: "block",
      reason: formatSuccess({
        message: `Download and install a profile from the Nori profile registry.\n\nUsage: /nori-registry-download <profile-name>[@version] [registry-url]\n\nExamples:\n  /nori-registry-download my-profile\n  /nori-registry-download my-profile@1.0.0\n  /nori-registry-download my-profile https://private-registry.com\n\nUse /nori-registry-search to find available profiles.`,
      }),
    };
  }

  const { profileName, version, registryUrl } = profileSpec;

  // Find installation directory
  const allInstallations = getInstallDirs({ currentDir: cwd });

  if (allInstallations.length === 0) {
    return {
      decision: "block",
      reason: formatError({
        message: `No Nori installation found.\n\nRun 'npx nori-ai install' to install Nori Profiles.`,
      }),
    };
  }

  if (allInstallations.length > 1) {
    const installList = allInstallations
      .map((dir, index) => `${index + 1}. ${dir}`)
      .join("\n");

    return {
      decision: "block",
      reason: formatError({
        message: `Found multiple Nori installations. Cannot determine which one to use.\n\nInstallations found:\n${installList}\n\nPlease navigate to the specific installation directory and try again.`,
      }),
    };
  }

  const installDir = allInstallations[0];
  const profilesDir = path.join(installDir, ".claude", "profiles");
  const targetDir = path.join(profilesDir, profileName);

  // Check if profile already exists
  try {
    await fs.access(targetDir);
    // Directory exists - warn user
    return {
      decision: "block",
      reason: formatError({
        message: `Profile "${profileName}" already exists at:\n${targetDir}\n\nTo reinstall, first remove the existing profile directory.`,
      }),
    };
  } catch {
    // Directory doesn't exist - continue
  }

  // Load config to get registry authentication
  const config = await loadConfig({ installDir });

  // Search for the profile
  let searchResults: Array<RegistrySearchResult>;

  if (registryUrl != null) {
    // User specified a specific registry
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
    return {
      decision: "block",
      reason: formatError({
        message: `Profile "${profileName}" not found in any registry.`,
      }),
    };
  }

  if (searchResults.length > 1) {
    return {
      decision: "block",
      reason: formatError({
        message: formatMultipleProfilesError({
          profileName,
          results: searchResults,
        }),
      }),
    };
  }

  // Single result - download from that registry
  const selectedRegistry = searchResults[0];

  // Download and extract the tarball
  try {
    const tarballData = await profileRegistryApi.downloadTarball({
      profileName,
      version: version ?? undefined,
      registryUrl: selectedRegistry.registryUrl,
      authToken: selectedRegistry.authToken,
    });

    // Create target directory only after successful download
    await fs.mkdir(targetDir, { recursive: true });

    try {
      await extractTarball({ tarballData, targetDir });
    } catch (extractErr) {
      // Clean up empty directory on extraction failure
      await fs.rm(targetDir, { recursive: true, force: true });
      throw extractErr;
    }

    const versionStr = version ? `@${version}` : " (latest)";
    return {
      decision: "block",
      reason: formatSuccess({
        message: `Downloaded and installed profile "${profileName}"${versionStr} from ${selectedRegistry.registryUrl}\n\nInstalled to: ${targetDir}\n\nYou can now use this profile with '/nori-switch-profile ${profileName}'.`,
      }),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      decision: "block",
      reason: formatError({
        message: `Failed to download profile "${profileName}":\n${errorMessage}`,
      }),
    };
  }
};

/**
 * nori-registry-download intercepted slash command
 */
export const noriRegistryDownload: InterceptedSlashCommand = {
  matchers: [
    "^\\/nori-registry-download\\s*$", // Bare command (no profile) - shows help
    "^\\/nori-registry-download\\s+[a-z0-9-]+(?:@\\d+\\.\\d+\\.\\d+.*)?(?:\\s+https?://\\S+)?\\s*$", // Command with profile and optional registry URL
  ],
  run,
};
