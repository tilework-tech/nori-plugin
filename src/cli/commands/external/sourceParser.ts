/**
 * GitHub URL source parser for the external command
 *
 * Parses various GitHub URL formats into a structured representation
 * for cloning and skill discovery.
 */

/**
 * Parsed GitHub source information
 */
export type ParsedGitHubSource = {
  url: string;
  ref: string | null;
  subpath: string | null;
  skillFilter: string | null;
};

/**
 * Parse a GitHub source string into structured format.
 *
 * Supported formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/tree/branch
 * - https://github.com/owner/repo/tree/branch/path/to/skills
 * - owner/repo (shorthand)
 * - owner/repo/path/to/skills (shorthand with subpath)
 * - owner/repo@skill-name (shorthand with skill filter)
 * - git@github.com:owner/repo.git (SSH)
 *
 * @param args - The function arguments
 * @param args.source - The source string to parse
 *
 * @returns Parsed source or null if not a valid GitHub source
 */
export const parseGitHubSource = (args: {
  source: string;
}): ParsedGitHubSource | null => {
  const { source } = args;

  if (source.length === 0) {
    return null;
  }

  // Reject local paths
  if (
    source.startsWith("./") ||
    source.startsWith("../") ||
    source.startsWith("/") ||
    source === "." ||
    source === ".."
  ) {
    return null;
  }

  // SSH URL: git@github.com:owner/repo.git
  const sshMatch = source.match(
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
  );
  if (sshMatch) {
    const [, owner, repo] = sshMatch;
    return {
      url: `git@github.com:${owner}/${repo}.git`,
      ref: null,
      subpath: null,
      skillFilter: null,
    };
  }

  // GitHub URL with tree/branch/path: https://github.com/owner/repo/tree/branch/path
  const githubTreeWithPathMatch = source.match(
    /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/,
  );
  if (githubTreeWithPathMatch) {
    const [, owner, repo, ref, subpath] = githubTreeWithPathMatch;
    return {
      url: `https://github.com/${owner}/${repo}.git`,
      ref: ref!,
      subpath: subpath!,
      skillFilter: null,
    };
  }

  // GitHub URL with tree/branch only: https://github.com/owner/repo/tree/branch
  const githubTreeMatch = source.match(
    /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)$/,
  );
  if (githubTreeMatch) {
    const [, owner, repo, ref] = githubTreeMatch;
    return {
      url: `https://github.com/${owner}/${repo}.git`,
      ref: ref!,
      subpath: null,
      skillFilter: null,
    };
  }

  // GitHub full URL: https://github.com/owner/repo
  const githubRepoMatch = source.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
  );
  if (githubRepoMatch) {
    const [, owner, repo] = githubRepoMatch;
    return {
      url: `https://github.com/${owner}/${repo}.git`,
      ref: null,
      subpath: null,
      skillFilter: null,
    };
  }

  // Reject non-GitHub URLs
  if (source.startsWith("http://") || source.startsWith("https://")) {
    return null;
  }

  // Shorthand with @skill filter: owner/repo@skill-name
  const atSkillMatch = source.match(/^([^/]+)\/([^/@]+)@(.+)$/);
  if (atSkillMatch && !source.includes(":") && !source.startsWith(".")) {
    const [, owner, repo, skillFilter] = atSkillMatch;
    return {
      url: `https://github.com/${owner}/${repo}.git`,
      ref: null,
      subpath: null,
      skillFilter: skillFilter!,
    };
  }

  // Shorthand: owner/repo or owner/repo/subpath
  const shorthandMatch = source.match(/^([^/]+)\/([^/]+)(?:\/(.+))?$/);
  if (shorthandMatch && !source.includes(":") && !source.startsWith(".")) {
    const [, owner, repo, subpath] = shorthandMatch;
    return {
      url: `https://github.com/${owner}/${repo}.git`,
      ref: null,
      subpath: subpath ?? null,
      skillFilter: null,
    };
  }

  return null;
};
