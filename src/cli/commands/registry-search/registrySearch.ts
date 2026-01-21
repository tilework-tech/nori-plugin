/**
 * CLI command for searching profile packages and skills in the Nori registrar
 * Handles: nori-ai registry-search <query>
 * Searches the user's org registry for both profiles and skills (requires config.auth)
 */

import { registrarApi, type Package } from "@/api/registrar.js";
import { getRegistryAuthToken } from "@/api/registryAuth.js";
import {
  checkRegistryAgentSupport,
  showCursorAgentNotSupportedError,
} from "@/cli/commands/registryAgentCheck.js";
import { loadConfig } from "@/cli/config.js";
import { error, info, newline, raw } from "@/cli/logger.js";
import { getInstallDirs, normalizeInstallDir } from "@/utils/path.js";
import { extractOrgId, buildRegistryUrl } from "@/utils/url.js";

import type { RegistryAuth } from "@/cli/config.js";
import type { Command } from "commander";

/**
 * Result from searching profiles in a registry
 */
type ProfileSearchResult = {
  registryUrl: string;
  packages: Array<Package>;
  error?: string | null;
};

/**
 * Result from searching skills in a registry
 */
type SkillSearchResult = {
  registryUrl: string;
  skills: Array<Package>;
  error?: string | null;
};

/**
 * Search the org registry for profiles
 * @param args - Search parameters
 * @param args.query - The search query string
 * @param args.registryUrl - The registry URL to search
 * @param args.registryAuth - The registry authentication credentials
 *
 * @returns Search result for profiles
 */
const searchOrgRegistryProfiles = async (args: {
  query: string;
  registryUrl: string;
  registryAuth: RegistryAuth;
}): Promise<ProfileSearchResult> => {
  const { query, registryUrl, registryAuth } = args;

  try {
    const authToken = await getRegistryAuthToken({ registryAuth });
    const packages = await registrarApi.searchPackagesOnRegistry({
      query,
      registryUrl,
      authToken,
    });
    return { registryUrl, packages };
  } catch (err) {
    return {
      registryUrl,
      packages: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

/**
 * Search the org registry for skills
 * @param args - Search parameters
 * @param args.query - The search query string
 * @param args.registryUrl - The registry URL to search
 * @param args.registryAuth - The registry authentication credentials
 *
 * @returns Search result for skills
 */
const searchOrgRegistrySkills = async (args: {
  query: string;
  registryUrl: string;
  registryAuth: RegistryAuth;
}): Promise<SkillSearchResult> => {
  const { query, registryUrl, registryAuth } = args;

  try {
    const authToken = await getRegistryAuthToken({ registryAuth });
    const skills = await registrarApi.searchSkills({
      query,
      registryUrl,
      authToken,
    });
    return { registryUrl, skills };
  } catch (err) {
    return {
      registryUrl,
      skills: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

/**
 * Format a list of packages/skills for display
 * @param args - The items to format
 * @param args.registryUrl - The registry URL
 * @param args.items - Array of packages or skills
 *
 * @returns Formatted string
 */
const formatItems = (args: {
  registryUrl: string;
  items: Array<Package>;
}): string => {
  const { registryUrl, items } = args;
  const lines: Array<string> = [];

  lines.push(registryUrl);
  for (const item of items) {
    const description = item.description ? `: ${item.description}` : "";
    lines.push(`  -> ${item.name}${description}`);
  }

  return lines.join("\n");
};

/**
 * Format unified search results for display with section headers
 * @param args - The results to format
 * @param args.profileResult - Profile search result
 * @param args.skillResult - Skill search result
 *
 * @returns Formatted string
 */
const formatUnifiedSearchResults = (args: {
  profileResult: ProfileSearchResult;
  skillResult: SkillSearchResult;
}): string => {
  const { profileResult, skillResult } = args;
  const sections: Array<string> = [];

  // Profiles section
  if (profileResult.error != null) {
    sections.push(
      `Profiles:\n${profileResult.registryUrl}\n  -> Error: ${profileResult.error}`,
    );
  } else if (profileResult.packages.length > 0) {
    const formattedProfiles = formatItems({
      registryUrl: profileResult.registryUrl,
      items: profileResult.packages,
    });
    sections.push(`Profiles:\n${formattedProfiles}`);
  }

  // Skills section
  if (skillResult.error != null) {
    sections.push(
      `Skills:\n${skillResult.registryUrl}\n  -> Error: ${skillResult.error}`,
    );
  } else if (skillResult.skills.length > 0) {
    const formattedSkills = formatItems({
      registryUrl: skillResult.registryUrl,
      items: skillResult.skills,
    });
    sections.push(`Skills:\n${formattedSkills}`);
  }

  return sections.join("\n\n");
};

/**
 * Build the download hints based on what results were found
 * @param args - The results
 * @param args.hasProfiles - Whether profiles were found
 * @param args.hasSkills - Whether skills were found
 *
 * @returns Hint message
 */
const buildDownloadHints = (args: {
  hasProfiles: boolean;
  hasSkills: boolean;
}): string => {
  const { hasProfiles, hasSkills } = args;
  const hints: Array<string> = [];

  if (hasProfiles) {
    hints.push(
      "To install a profile, run: nori-ai registry-download <package-name>",
    );
  }
  if (hasSkills) {
    hints.push("To install a skill, run: nori-ai skill-download <skill-name>");
  }

  return hints.join("\n");
};

/**
 * Search for profiles and skills in your org's registry
 * @param args - The search parameters
 * @param args.query - The search query
 * @param args.installDir - Optional installation directory (detected if not provided)
 */
export const registrySearchMain = async (args: {
  query: string;
  installDir?: string | null;
}): Promise<void> => {
  const { query, installDir } = args;

  // Determine effective install directory
  let effectiveInstallDir: string;
  if (installDir != null) {
    // Use provided installDir (normalized)
    effectiveInstallDir = normalizeInstallDir({ installDir });
  } else {
    // Auto-detect from current directory
    const allInstallations = getInstallDirs({ currentDir: process.cwd() });
    if (allInstallations.length === 0) {
      error({
        message:
          "No Nori installation found.\n\nRun 'npx nori-ai install' to install Nori Profiles.",
      });
      return;
    }
    effectiveInstallDir = allInstallations[0];
  }

  // Check if cursor-agent-only installation (not supported for registry commands)
  const agentCheck = await checkRegistryAgentSupport({
    installDir: effectiveInstallDir,
  });
  if (!agentCheck.supported) {
    showCursorAgentNotSupportedError();
    return;
  }

  // Load config and check for org auth
  const config = await loadConfig({ installDir: effectiveInstallDir });

  if (config?.auth == null || config.auth.organizationUrl == null) {
    error({
      message:
        "No organization configured.\n\nRun 'nori-ai install' to set up your organization credentials.",
    });
    return;
  }

  // Extract org ID and build registry URL
  const orgId = extractOrgId({ url: config.auth.organizationUrl });
  if (orgId == null) {
    error({
      message:
        "Invalid organization URL in config.\n\nRun 'nori-ai install' to reconfigure your credentials.",
    });
    return;
  }

  const registryUrl = buildRegistryUrl({ orgId });
  const registryAuth: RegistryAuth = {
    registryUrl,
    username: config.auth.username,
    refreshToken: config.auth.refreshToken ?? null,
  };

  // Search both profiles and skills in parallel
  const [profileResult, skillResult] = await Promise.all([
    searchOrgRegistryProfiles({
      query,
      registryUrl,
      registryAuth,
    }),
    searchOrgRegistrySkills({
      query,
      registryUrl,
      registryAuth,
    }),
  ]);

  // Check if we have any results or errors to display
  const hasProfileResults = profileResult.packages.length > 0;
  const hasSkillResults = skillResult.skills.length > 0;
  const hasProfileError = profileResult.error != null;
  const hasSkillError = skillResult.error != null;

  // Handle case where both failed
  if (hasProfileError && hasSkillError) {
    error({
      message: `Failed to search:\n\nProfiles: ${profileResult.error}\nSkills: ${skillResult.error}`,
    });
    return;
  }

  // Handle no results (and no errors that need displaying)
  if (
    !hasProfileResults &&
    !hasSkillResults &&
    !hasProfileError &&
    !hasSkillError
  ) {
    info({ message: `No profiles or skills found matching "${query}".` });
    return;
  }

  // Format and display results
  const formattedResults = formatUnifiedSearchResults({
    profileResult,
    skillResult,
  });

  newline();
  raw({ message: formattedResults });
  newline();

  // Show appropriate download hints
  const hints = buildDownloadHints({
    hasProfiles: hasProfileResults,
    hasSkills: hasSkillResults,
  });
  if (hints) {
    info({ message: hints });
  }
};

/**
 * Register the 'registry-search' command with commander
 * @param args - Configuration arguments
 * @param args.program - Commander program instance
 */
export const registerRegistrySearchCommand = (args: {
  program: Command;
}): void => {
  const { program } = args;

  program
    .command("registry-search <query>")
    .description("Search for profiles and skills in your org's registry")
    .action(async (query: string) => {
      // Get global options from parent
      const globalOpts = program.opts();
      await registrySearchMain({
        query,
        installDir: globalOpts.installDir || null,
      });
    });
};
