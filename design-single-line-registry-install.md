# Design: Single-line skillset install from public Nori registry

## Goal
Enable a single command to install a skillset from the default public Nori registry without any prior Nori installation or settings. The flow must:
- Download the skillset from the default public registry.
- Create a repo-level or user-level installation (no login or user info required).
- Skip the interactive install form and settings prompts.
- Activate the chosen skillset immediately.

## Non-goals
- Paid/private registries, authentication, or registry credential management.
- Editing existing profile metadata or authoring skillsets.
- Replacing the full interactive install flow.

## Proposed CLI UX
Introduce a new command and aliases:

```bash
nori-ai registry-install <skillset> [--version <semver>] [--install-dir <path>] [--user]
# alias
nori-ai install-skillset <skillset> ...
```

Examples:

```bash
# Repo-level install in the current directory (default)
nori-ai registry-install senior-swe

# User-level install in ~
nori-ai registry-install senior-swe --user

# Pin a version
nori-ai registry-install senior-swe --version 2.1.0
```

Behavior:
- `--user` sets `installDir = os.homedir()`.
- `--install-dir` overrides both repo/user defaults.
- `--version` maps to the registry download version selector.
- The command is always non-interactive and does not prompt.

## High-level flow
1. **Resolve install directory**
   - Default: `process.cwd()` (repo install).
   - If `--user`, use `os.homedir()`.
   - If `--install-dir`, use that path.
2. **Ensure required directories**
   - Create `<installDir>/.claude/` and `<installDir>/.claude/profiles/` if missing.
3. **Download the skillset**
   - Use the existing public registry download code path (`registry-download`) but scoped to the default public registry only.
   - Extract to `<installDir>/.claude/profiles/<skillset>/`.
4. **Prepare config (free mode)**
   - Create/overwrite `<installDir>/.nori-config.json` with:
     - `agents.claude-code.profile = <skillset>`
     - `auth = null` (free tier)
     - `installDir = <installDir>`
     - `registryAuths = []`
     - `sendSessionTranscript` and `autoupdate` defaulted per schema
   - Do not prompt for credentials.
5. **Run install loaders without prompts**
   - Invoke the existing install pipeline (loaders) in non-interactive mode.
   - Skip profile selection prompts by passing the chosen profile in config.
   - Ensure it uses the downloaded profile directory as source of truth.
6. **Activate the skillset**
   - Re-generate managed `CLAUDE.md` and copy skills/subagents/slashcommands from the downloaded profile.
   - The installed profile is immediately active via config.

## Required code changes
### 1) New command module
Add `src/cli/commands/registry-install/registryInstall.ts`:
- Parse args/options: `<skillset>`, `--version`, `--install-dir`, `--user`.
- Resolve installDir (repo/user/custom).
- Call a shared helper that combines registry download + non-interactive install.
- Always `--silent` compatible: respect global flags.

### 2) Extract shared helper from registry-download
Currently `registry-download` assumes an existing installation found via `getInstallDirs()` and fails if none exist. Introduce a helper:

```ts
// src/cli/commands/registry-download/registryDownloadHelpers.ts
export async function downloadProfileToDir({
  packageName,
  version,
  registryUrl,
  installDir,
}: { ... }): Promise<{ profileDir: string }>;
```

- Accept an explicit `installDir` so it can be used during first-time install.
- Default `registryUrl` to the public registrar URL when not provided.
- Keep auth optional; for the new command, pass no auth.

### 3) Non-interactive install entry point
Add a new internal function in `src/cli/commands/install/install.ts`:

```ts
export async function installWithConfig({
  installDir,
  configOverrides,
  skipUninstall,
}: { ... }): Promise<void>;
```

Responsibilities:
- Load/migrate existing config if present.
- Merge `configOverrides` (ensures profile is preselected and auth is null).
- Run loader registry in non-interactive mode.
- Avoid prompting by bypassing `promptForConfig()` when overrides are provided.

This enables both `registry-install` and future automation to share the non-interactive path without duplicating installer logic.

### 4) Ensure loader inputs read from profiles directory
Confirm that loaders read from `<installDir>/.claude/profiles/` (already true) so the downloaded profile is treated the same as built-in ones.

## Error handling
- If download fails, clean up the partially created profile directory.
- If install fails after download, leave the downloaded profile in place but return a clear error.
- If a profile with the same name exists, provide `--force` to replace, otherwise fail with a message.

## Security & privacy
- No login prompts.
- No registry auth required for public registry.
- Config contains no user identifiers beyond local defaults.

## Testing strategy
- Unit tests for `downloadProfileToDir()` with a mocked registry response.
- Integration test for `registry-install`:
  - Run in a temp dir with no existing config.
  - Assert `/.nori-config.json` created with chosen profile.
  - Assert `/.claude/profiles/<skillset>` exists.
  - Assert `CLAUDE.md` contains the managed block and profile name.

## Rollout plan
- Ship behind a new command `registry-install`.
- Update `README.md` with a new “single-line install” section.
- Consider adding a short alias in `nori-ai help` output.
