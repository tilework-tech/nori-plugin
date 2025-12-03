# Multi-Registry Search Implementation Plan

**Goal:** Modify `/nori-registry-search` to search across all configured registries (public + private) and display results grouped by registry URL.

**Architecture:**
- Modify `nori-registry-search.ts` to iterate through all registries in `config.registryAuths` plus the public registry
- Create a parameterized search function that can call any registry URL with optional authentication
- Aggregate results and display them grouped by registry URL with the format specified

**Tech Stack:** TypeScript, Firebase Auth (for private registries), Node.js fetch API

---

## Testing Plan

I will add tests for the following behaviors:

1. **Search public registry only (no registryAuths configured)** - When no private registries are configured, search only the public registry and display results under its URL
2. **Search multiple registries** - When registryAuths contains private registries, search all of them plus the public registry
3. **Display format** - Results should be grouped by registry URL with package name, version, and description
4. **Authentication for private registries** - Private registries should use Bearer token from Firebase auth
5. **Error handling per registry** - If one registry fails, other results should still be displayed
6. **No results across all registries** - Display appropriate message when no packages found anywhere

The tests will mock:
- `fetch` (for API calls to both public and private registries)
- `getRegistryAuthToken` (for private registry authentication)
- `loadConfig` (for config with registryAuths)

NOTE: I will write *all* tests before I add any implementation behavior.

---

## Step 1: Create Parameterized Search Function

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-registry-search/src/api/registrar.ts`

### 1.1 Add New Search Function That Accepts Registry URL

The current `searchPackages` function hardcodes `REGISTRAR_URL`. Add a new function that accepts a registry URL and optional auth token:

```typescript
/**
 * Search packages on a specific registry
 * @param args - Search parameters including registry URL
 * @returns Array of matching packages
 */
searchPackagesOnRegistry: async (args: {
  query: string;
  registryUrl: string;
  authToken?: string | null;
  limit?: number | null;
  offset?: number | null;
}): Promise<Array<Package>> => {
  const { query, registryUrl, authToken, limit, offset } = args;

  const params = new URLSearchParams({ q: query });
  if (limit != null) params.set("limit", limit.toString());
  if (offset != null) params.set("offset", offset.toString());

  const url = `${registryUrl}/api/packages/search?${params.toString()}`;

  const headers: Record<string, string> = {};
  if (authToken != null) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({
      error: `HTTP ${response.status}`,
    }))) as { error?: string };
    throw new Error(errorData.error ?? `HTTP ${response.status}`);
  }

  return (await response.json()) as Array<Package>;
};
```

---

## Step 2: Add Types for Multi-Registry Results

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-registry-search/src/installer/features/hooks/config/intercepted-slashcommands/nori-registry-search.ts`

### 2.1 Define Result Type

```typescript
type RegistrySearchResult = {
  registryUrl: string;
  packages: Array<Package>;
  error?: string | null;
};
```

---

## Step 3: Update Search Slash Command

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-registry-search/src/installer/features/hooks/config/intercepted-slashcommands/nori-registry-search.ts`

### 3.1 Add Imports

```typescript
import { loadConfig } from "@/installer/config.js";
import { getRegistryAuthToken } from "@/api/registryAuth.js";
import { REGISTRAR_URL, registrarApi, type Package } from "@/api/registrar.js";
```

### 3.2 Create Multi-Registry Search Function

```typescript
/**
 * Search across all configured registries
 * @param args - Search parameters
 * @returns Array of results per registry
 */
const searchAllRegistries = async (args: {
  query: string;
  installDir: string;
}): Promise<Array<RegistrySearchResult>> => {
  const { query, installDir } = args;
  const results: Array<RegistrySearchResult> = [];

  // Load config to get registry auths
  const config = await loadConfig({ installDir });

  // Always search public registry (no auth required)
  try {
    const packages = await registrarApi.searchPackagesOnRegistry({
      query,
      registryUrl: REGISTRAR_URL,
    });
    results.push({ registryUrl: REGISTRAR_URL, packages });
  } catch (err) {
    results.push({
      registryUrl: REGISTRAR_URL,
      packages: [],
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Search private registries if configured
  if (config?.registryAuths != null) {
    for (const registryAuth of config.registryAuths) {
      try {
        // Get auth token for this registry
        const authToken = await getRegistryAuthToken({ registryAuth });

        const packages = await registrarApi.searchPackagesOnRegistry({
          query,
          registryUrl: registryAuth.registryUrl,
          authToken,
        });
        results.push({ registryUrl: registryAuth.registryUrl, packages });
      } catch (err) {
        results.push({
          registryUrl: registryAuth.registryUrl,
          packages: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return results;
};
```

### 3.3 Update Run Function to Use Multi-Registry Search

Update the `run` function to:
1. Call `searchAllRegistries` instead of `registrarApi.searchPackages`
2. Format results grouped by registry URL
3. Include version in package display (requires fetching packument or updating API response)

### 3.4 Format Results Function

```typescript
/**
 * Format multi-registry search results for display
 * @param args - The results to format
 * @returns Formatted string
 */
const formatSearchResults = (args: {
  results: Array<RegistrySearchResult>;
  query: string;
}): string => {
  const { results, query } = args;
  const lines: Array<string> = [];

  let totalPackages = 0;

  for (const result of results) {
    if (result.error != null) {
      lines.push(`${result.registryUrl}`);
      lines.push(`  -> Error: ${result.error}`);
      lines.push("");
      continue;
    }

    if (result.packages.length === 0) {
      continue; // Skip registries with no results
    }

    totalPackages += result.packages.length;
    lines.push(result.registryUrl);
    for (const pkg of result.packages) {
      const description = pkg.description ? `: ${pkg.description}` : "";
      // Note: Package type doesn't include version - would need packument call
      // For now, show name only; can enhance later
      lines.push(`  -> ${pkg.name}${description}`);
    }
    lines.push("");
  }

  if (totalPackages === 0) {
    return `No profiles found matching "${query}" in any registry.`;
  }

  return lines.join("\n").trim();
};
```

---

## Step 4: Update Run Function

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-registry-search/src/installer/features/hooks/config/intercepted-slashcommands/nori-registry-search.ts`

Replace the existing search logic with:

```typescript
const run = async (args: { input: HookInput }): Promise<HookOutput | null> => {
  const { input } = args;
  const { prompt, cwd } = input;

  // Parse query from prompt
  const query = parseQuery(prompt);
  if (query == null) {
    return {
      decision: "block",
      reason: formatSuccess({
        message: `Search for profile packages across all configured registries.\n\nUsage: /nori-registry-search <query>\n\nExamples:\n  /nori-registry-search typescript\n  /nori-registry-search react developer`,
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

  // Search all registries
  try {
    const results = await searchAllRegistries({ query, installDir });
    const formattedResults = formatSearchResults({ results, query });

    // Check if we have any packages
    const hasPackages = results.some((r) => r.packages.length > 0);

    if (!hasPackages) {
      return {
        decision: "block",
        reason: formatSuccess({
          message: `No profiles found matching "${query}" in any registry.\n\nTry a different search term.`,
        }),
      };
    }

    return {
      decision: "block",
      reason: formatSuccess({
        message: `Search results for "${query}":\n\n${formattedResults}\n\nTo install a profile, use: /nori-registry-download <package-name>`,
      }),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      decision: "block",
      reason: formatError({
        message: `Failed to search profiles:\n${errorMessage}`,
      }),
    };
  }
};
```

---

## Edge Cases

1. **No Nori installation found** - Return error with install instructions
2. **Config file doesn't exist** - Proceed with public registry only
3. **No registryAuths configured** - Proceed with public registry only
4. **Private registry auth fails** - Show error for that registry, continue with others
5. **Private registry network error** - Show error for that registry, continue with others
6. **Public registry error** - Show error for public registry, continue with private ones
7. **No results in any registry** - Display "No profiles found" message
8. **Some registries have results, some don't** - Only show registries with results (or errors)

---

## Questions

1. **Version display**: The current `Package` type from search doesn't include version. The user's requested format shows `foo-bar@1.3.1`. Should we:
   - a) Add a packument call for each package to get latest version (more API calls, slower)
   - b) Update the search API to return version (requires backend change)
   - c) Display without version for now (simpler, matches current behavior)

2. **Registry URL normalization**: Should we normalize registry URLs before display (remove trailing slashes, etc.)?

3. **Description truncation**: Should we truncate long descriptions in the output?

---

## Testing Details

Tests will verify these BEHAVIORS:
- Search returns results grouped by registry URL
- Public registry is always searched (no auth needed)
- Private registries are searched with authentication
- Auth failures for one registry don't prevent searching others
- Network failures for one registry don't prevent searching others
- Empty results display appropriate message
- Format matches expected output (`https://url\n  -> package: description`)

Tests focus on integration behavior, not implementation details.

---

## Implementation Details

- Follow existing intercepted slash command pattern from `nori-registry-download.ts`
- Use named parameters pattern: `const fn = (args: { foo: string }) => {}`
- Use `@/` imports throughout
- Use `== null` for null checks
- Reuse existing utilities: `getInstallDirs`, `loadConfig`, `formatSuccess`, `formatError`
- Reuse `getRegistryAuthToken` from `@/api/registryAuth.js` for private registry auth
- Add new `searchPackagesOnRegistry` to `registrarApi` to support custom registry URLs

---
