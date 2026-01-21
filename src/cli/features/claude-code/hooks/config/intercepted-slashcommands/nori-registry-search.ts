/**
 * Intercepted slash command for searching profile packages and skills
 * Handles /nori-registry-search <query> command
 * Searches the user's org registry for both profiles and skills (requires config.auth)
 */

import { registrarApi, type Package } from "@/api/registrar.js";
import { getRegistryAuthToken } from "@/api/registryAuth.js";
import { loadConfig } from "@/cli/config.js";
import { getInstallDirs } from "@/utils/path.js";
import { extractOrgId, buildRegistryUrl } from "@/utils/url.js";

import type {
  HookInput,
  HookOutput,
  InterceptedSlashCommand,
} from "./types.js";
import type { RegistryAuth } from "@/cli/config.js";

import { formatError, formatSuccess } from "./format.js";

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
 * Parse search query from prompt
 * @param prompt - The user prompt to parse
 *
 * @returns The search query or null if invalid
 */
const parseQuery = (prompt: string): string | null => {
  const match = prompt.trim().match(/^\/nori-registry-search\s+(.+)$/i);

  if (!match) {
    return null;
  }

  return match[1].trim();
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
      "To install a profile, use: /nori-registry-download <package-name>",
    );
  }
  if (hasSkills) {
    hints.push("To install a skill, use: /nori-skill-download <skill-name>");
  }

  return hints.join("\n");
};

/**
 * Run the nori-registry-search command
 * @param args - The function arguments
 * @param args.input - The hook input containing prompt and cwd
 *
 * @returns The hook output with search results, or null if not handled
 */
const run = async (args: { input: HookInput }): Promise<HookOutput | null> => {
  const { input } = args;
  const { prompt, cwd } = input;

  // Parse query from prompt
  const query = parseQuery(prompt);
  if (query == null) {
    return {
      decision: "block",
      reason: formatSuccess({
        message: `Search for profiles and skills in your org's registry.\n\nUsage: /nori-registry-search <query>\n\nExamples:\n  /nori-registry-search typescript\n  /nori-registry-search react developer`,
      }),
    };
  }

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

  const installDir = allInstallations[0];

  // Load config and check for org auth
  const config = await loadConfig({ installDir });

  if (config?.auth == null || config.auth.organizationUrl == null) {
    return {
      decision: "block",
      reason: formatError({
        message: `No organization configured.\n\nRun 'nori-ai install' to set up your organization credentials.`,
      }),
    };
  }

  // Extract org ID and build registry URL
  const orgId = extractOrgId({ url: config.auth.organizationUrl });
  if (orgId == null) {
    return {
      decision: "block",
      reason: formatError({
        message: `Invalid organization URL in config.\n\nRun 'nori-ai install' to reconfigure your credentials.`,
      }),
    };
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
    return {
      decision: "block",
      reason: formatError({
        message: `Failed to search:\n\nProfiles: ${profileResult.error}\nSkills: ${skillResult.error}`,
      }),
    };
  }

  // Handle no results (and no errors that need displaying)
  if (
    !hasProfileResults &&
    !hasSkillResults &&
    !hasProfileError &&
    !hasSkillError
  ) {
    return {
      decision: "block",
      reason: formatSuccess({
        message: `No profiles or skills found matching "${query}".\n\nTry a different search term.`,
      }),
    };
  }

  // Format and display results
  const formattedResults = formatUnifiedSearchResults({
    profileResult,
    skillResult,
  });

  // Build download hints
  const hints = buildDownloadHints({
    hasProfiles: hasProfileResults,
    hasSkills: hasSkillResults,
  });

  return {
    decision: "block",
    reason: formatSuccess({
      message: `Search results for "${query}":\n\n${formattedResults}${hints ? `\n\n${hints}` : ""}`,
    }),
  };
};

/**
 * nori-registry-search intercepted slash command
 */
export const noriRegistrySearch: InterceptedSlashCommand = {
  matchers: [
    "^\\/nori-registry-search\\s*$", // Bare command (no query) - shows help
    "^\\/nori-registry-search\\s+.+$", // Command with query
  ],
  run,
};
