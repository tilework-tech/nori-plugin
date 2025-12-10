# Noridoc: cursor

Path: @/src/cli/features/cursor

### Overview

Feature loader registry and implementations for installing Nori components into Cursor IDE. Uses a separate CursorLoaderRegistry singleton that mirrors the main LoaderRegistry pattern but writes to `~/.cursor/` instead of `~/.claude/`. Implements profiles installation, slash commands installation, and hooks configuration for slash command interception.

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
    - skills/                    - commands/
    - commands/                  - hooks.json
    - hooks/
```

The `install-cursor` command (@/src/cli/commands/install-cursor/installCursor.ts) uses CursorLoaderRegistry to execute all registered Cursor loaders. The `uninstall-cursor` command (@/src/cli/commands/uninstall-cursor/uninstallCursor.ts) uses `CursorLoaderRegistry.getAllReversed()` to run loader uninstalls in reverse order. The cursor profiles loader reuses the same profile template source files from @/src/cli/features/profiles/config/ but writes to `~/.cursor/profiles/` via Cursor-specific path helpers in @/src/cli/env.ts. The `cursor-switch-profile` command (@/src/cli/commands/cursor-switch-profile/cursorSwitchProfile.ts) updates `config.cursorProfile.baseProfile` and then invokes `install-cursor` to reinstall with only the selected profile.

Cursor environment path helpers (getCursorDir, getCursorSettingsFile, getCursorProfilesDir, getCursorCommandsDir, getCursorHomeDir, getCursorHomeSettingsFile, getCursorHooksFile, getCursorHomeHooksFile) in @/src/cli/env.ts parallel the existing Claude path helpers.

### Core Implementation

**CursorLoaderRegistry** (cursorLoaderRegistry.ts): Singleton registry managing Cursor feature loaders. Implements the same interface as LoaderRegistry with getAll() and getAllReversed() methods. Registers loaders in order: cursorProfilesLoader, cursorSlashCommandsLoader, then cursorHooksLoader.

**Cursor Profiles Loader** (profiles/loader.ts): Installs profile templates to `~/.cursor/profiles/`. Key behaviors:
- Reuses profile templates from @/src/cli/features/profiles/config/ (no separate Cursor templates)
- Applies mixin composition logic identical to the Claude profiles loader
- Configures permissions by updating `~/.cursor/settings.json` with additionalDirectories
- Validates installation by checking required profiles and permissions configuration
- When `config.cursorProfile.baseProfile` is set, installs only that profile instead of all profiles

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

The adapter routes prompts through the same `interceptedSlashCommands` registry from @/src/cli/features/hooks/config/intercepted-slashcommands/, enabling `/nori-*` slash commands to work instantly without LLM inference.

### Things to Know

All loaders implement the same `Loader` interface from @/src/cli/features/loaderRegistry.ts, enabling consistent run/uninstall/validate behavior. The profiles loader:
- Injects conditional paid mixins based on config.auth presence (isPaidUser check)
- Composes profiles from mixins in alphabetical order
- Updates Cursor settings.json with profiles directory in permissions.additionalDirectories
- During uninstall, only removes builtin profiles (identified by `"builtin": true` in profile.json), preserving user-created profiles

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
