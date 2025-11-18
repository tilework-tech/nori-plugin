/**
 * URL normalization utilities
 * Handles trailing slashes and path joining to prevent double slashes in URLs
 */

/**
 * Normalize a base URL by removing trailing slashes
 * @param args - Normalization arguments
 * @param args.baseUrl - The base URL to normalize (e.g., "https://example.com/")
 * @param args.path - Optional path to append (e.g., "/api/endpoint")
 *
 * @returns Normalized URL with no double slashes
 *
 * @example
 * normalizeUrl({ baseUrl: "https://example.com/", path: "/api/test" })
 * // Returns: "https://example.com/api/test"
 * @example
 * normalizeUrl({ baseUrl: "https://example.com", path: "api/test" })
 * // Returns: "https://example.com/api/test"
 */
export const normalizeUrl = (args: {
  baseUrl: string;
  path?: string | null;
}): string => {
  const { baseUrl, path } = args;

  // Remove trailing slashes from base URL
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  // If no path provided, return normalized base
  if (!path) {
    return normalizedBase;
  }

  // Ensure path starts with exactly one slash
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
};
