# Noridoc: cursor

Path: @/src/cli/features/cursor

### Overview

Feature loader registry and implementations for installing Nori components into Cursor IDE. Uses a two-tier registry architecture: CursorLoaderRegistry for top-level loaders, and CursorProfileLoaderRegistry for profile-dependent loaders (skills, AGENTS.md). Installs profiles, skills, AGENTS.md, slash commands, and hooks to `~/.cursor/`.

### How it fits into the larger codebase

This directory provides Cursor IDE support parallel to the main Claude Code installation system. The architecture mirrors @/src/cli/features/ but operates on Cursor-specific paths:

```
+----------------------+     +------------------------+
|    LoaderRegistry    |     |  CursorLoaderRegistry  |
|   (@/src/cli/        |     |  (@/src/cli/features/  |
|    features/)        |     |   cursor/)             |
+----------------------+     +------------------------+
         |                            |
         v                            v
    ~/.claude/                   ~/.cursor/
    - profiles/                  - profiles/
    - settings.json              - settings.json
    - skills/                    - skills/
    - CLAUDE.md                  - AGENTS.md
    - commands/                  - commands/
    - hooks/                     - hooks.json
```

The `install-cursor` command (@/src/cli/commands/install-cursor/installCursor.ts) uses CursorLoaderRegistry to execute all registered Cursor loaders. The `uninstall-cursor` command (@/src/cli/commands/uninstall-cursor/uninstallCursor.ts) uses `CursorLoaderRegistry.getAllReversed()` to run loader uninstalls in reverse order. The cursor profiles loader reuses the same profile template source files from @/src/cli/features/profiles/config/ but writes to `~/.cursor/profiles/` via Cursor-specific path helpers in @/src/cli/env.ts. Each profile directory contains an AGENTS.md template (Cursor's equivalent of CLAUDE.md) with the same coding instructions. The `cursor-switch-profile` command (@/src/cli/commands/cursor-switch-profile/cursorSwitchProfile.ts) updates `config.cursorProfile.baseProfile` and then invokes `install-cursor` to reinstall with only the selected profile.

Cursor environment path helpers (getCursorDir, getCursorSettingsFile, getCursorProfilesDir, getCursorCommandsDir, getCursorHomeDir, getCursorHomeSettingsFile, getCursorSkillsDir, getCursorAgentsMdFile, getCursorHooksFile, getCursorHomeHooksFile) in @/src/cli/env.ts parallel the existing Claude path helpers.

### Core Implementation

**CursorLoaderRegistry** (cursorLoaderRegistry.ts): Singleton registry managing top-level Cursor feature loaders. Implements the same interface as LoaderRegistry with getAll() and getAllReversed() methods. Registers loaders in order: cursorProfilesLoader, cursorSlashCommandsLoader, then cursorHooksLoader.

**CursorProfileLoaderRegistry** (profiles/cursorProfileLoaderRegistry.ts): Singleton registry managing profile-dependent loaders that must run after profiles are installed. Registration order matters - skills loader runs before agentsmd loader (which reads from skills).

**Cursor Profiles Loader** (profiles/loader.ts): Installs profile templates to `~/.cursor/profiles/`. Key behaviors:
- Reuses profile templates from @/src/cli/features/profiles/config/ (no separate Cursor templates)
- Applies mixin composition logic identical to the Claude profiles loader
- After installing profiles, invokes all CursorProfileLoaderRegistry loaders
- Configures permissions by updating `~/.cursor/settings.json` with additionalDirectories
- Validates installation by checking required profiles and permissions configuration
- When `config.cursorProfile.baseProfile` is set, installs only that profile instead of all profiles

**Cursor Skills Loader** (profiles/skills/loader.ts): Installs skills from selected profile's skills/ directory to `~/.cursor/skills/`. Key behaviors:
- Reads from `~/.cursor/profiles/{profile}/skills/` (post-mixin composition)
- Strips `paid-` prefix from skill directories for paid users, skips for free users
- Applies template substitution ({{skills_dir}}, {{profiles_dir}}) on markdown files
- Configures permissions in `~/.cursor/settings.json`

**Cursor AGENTS.md Loader** (profiles/agentsmd/loader.ts): Generates `~/.cursor/AGENTS.md` from profile template. Key behaviors:
- Reads AGENTS.md from `~/.cursor/profiles/{profile}/AGENTS.md`
- Generates skills list by globbing for SKILL.md files in installed skills
- Uses managed block pattern (`# BEGIN NORI-AI MANAGED BLOCK`) to preserve user content
- Applies template substitution for paths

**Cursor Slash Commands Loader** (slashcommands/loader.ts): Installs slash command markdown files to `~/.cursor/commands/`. Key behaviors:
- Reuses command markdown files from @/src/cli/features/slashcommands/config/ (shared with Claude loader)
- Applies template path substitution with `getCursorDir` so paths resolve to `~/.cursor/` instead of `~/.claude/`
- Validates installation by checking all expected commands are present in the commands directory

**Cursor Hooks Loader** (hooks/loader.ts): Configures Cursor IDE hooks for slash command interception. Writes to `~/.cursor/hooks.json` with Cursor's hook format:
```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [{ "command": "node /path/to/script.js" }]
  }
}
```

Key behaviors:
- Preserves existing non-Nori hooks in hooks.json
- Identifies Nori hooks by checking if command contains "cursor-before-submit-prompt"
- Only free-tier hooks are installed (paid features like summarize and statistics are skipped)
- SessionStart hooks (autoupdate, migration) are not available in Cursor (no equivalent event)

**Hook Adapter** (hooks/config/cursor-before-submit-prompt.ts): Transforms Cursor's `beforeSubmitPrompt` input format to Claude Code's `UserPromptSubmit` format:

| Cursor Field | Claude Code Field |
|--------------|-------------------|
| `prompt` | `prompt` |
| `workspace_roots[0]` | `cwd` |
| `conversation_id` | `session_id` |
| (n/a) | `transcript_path` (empty string) |
| `hook_event_name` | `hook_event_name` (mapped to "UserPromptSubmit") |

The adapter routes prompts through Cursor's own `cursorInterceptedSlashCommands` registry from @/src/cli/features/cursor/hooks/config/intercepted-slashcommands/, enabling `/nori-*` slash commands to work instantly without LLM inference.

**Cursor Intercepted Slash Commands** (hooks/config/intercepted-slashcommands/): Cursor-specific registry of slash commands that execute instantly via hook interception. This is a separate registry from Claude Code's intercepted slash commands at @/src/cli/features/hooks/config/intercepted-slashcommands/. Key architectural differences:

| Aspect | Claude Code Registry | Cursor Registry |
|--------|---------------------|-----------------|
| Location | @/src/cli/features/hooks/config/intercepted-slashcommands/ | @/src/cli/features/cursor/hooks/config/intercepted-slashcommands/ |
| Switch profile | Uses `~/.claude/profiles/`, updates `config.profile.baseProfile` | Uses `getCursorProfilesDir()`, updates `config.cursorProfile.baseProfile` |
| Toggle commands | Includes `nori-toggle-autoupdate`, `nori-toggle-session-transcripts` | Excludes toggle commands (Claude Code specific features) |
| Types/Format | Defines `HookInput`, `HookOutput`, `InterceptedSlashCommand` | Re-exports from Claude Code for consistency |

Cursor registry commands:
- `nori-install-location` - Shows installation directory (IDE-agnostic)
- `nori-registry-download` - Downloads skills from registry (IDE-agnostic)
- `nori-registry-search` - Searches skill registry (IDE-agnostic)
- `nori-registry-upload` - Uploads skills to registry (IDE-agnostic)
- `nori-switch-profile` - Cursor-specific implementation using Cursor paths

### Things to Know

The cursor profiles loader implements the `Loader` interface from @/src/cli/features/loaderRegistry.ts. Profile-dependent loaders (skills, agentsmd) use the `CursorProfileLoader` interface with `install`/`uninstall` methods. The loader hierarchy ensures:
- Profiles installed first (creates ~/.cursor/profiles/{profile}/)
- Skills installed second (reads from profiles, creates ~/.cursor/skills/)
- AGENTS.md installed third (reads skills list for embedding)

Mixin composition injects conditional paid mixins based on config.auth presence. Profiles are composed from mixins in alphabetical order. During uninstall, only builtin profiles (identified by `"builtin": true` in profile.json) are removed, preserving user-created profiles.

The AGENTS.md managed block pattern allows users to add custom instructions outside the block without losing them during reinstalls. If AGENTS.md becomes empty after removing the managed block during uninstall, the file is deleted.

The slash commands loader reads markdown files from the shared config directory at @/src/cli/features/slashcommands/config/, applies template substitution using `getCursorDir` (not `getClaudeDir`), and writes to `~/.cursor/commands/`. During uninstall, removes only commands that match the source config directory contents, and cleans up the directory if empty.

**Cursor vs Claude Code Hooks Architecture:**

| Aspect | Claude Code | Cursor |
|--------|-------------|--------|
| Config file | `~/.claude/settings.json` (TOML-based hooks array) | `~/.cursor/hooks.json` (JSON) |
| Hook format | `{ matcher, hooks: [{ type, command }] }` | `{ version: 1, hooks: { hookType: [{ command }] } }` |
| Event mapping | `UserPromptSubmit` | `beforeSubmitPrompt` |
| Session events | `SessionStart` available | No equivalent event |

The hook adapter is designed to fail gracefully - any errors result in `{ continue: true }` output, allowing the prompt to proceed normally rather than blocking user input.

The CursorLoaderRegistry is intentionally separate from LoaderRegistry to allow independent loader management.

Created and maintained by Nori.
