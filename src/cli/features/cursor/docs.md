# Noridoc: cursor

Path: @/src/cli/features/cursor

### Overview

Feature loader registry and implementations for installing Nori components into Cursor IDE. Uses a two-tier registry architecture: CursorLoaderRegistry for top-level loaders, and CursorProfileLoaderRegistry for profile-dependent loaders (skills, AGENTS.md). Installs profiles, skills, and AGENTS.md configuration to `~/.cursor/`.

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
    - commands/
    - hooks/
```

The `install-cursor` command (@/src/cli/commands/install-cursor/installCursor.ts) uses CursorLoaderRegistry to execute all registered Cursor loaders. The cursor profiles loader reuses the same profile template source files from @/src/cli/features/profiles/config/ but writes to `~/.cursor/profiles/` via Cursor-specific path helpers in @/src/cli/env.ts. Each profile directory contains an AGENTS.md template (Cursor's equivalent of CLAUDE.md) with the same coding instructions.

Cursor environment path helpers (getCursorDir, getCursorSettingsFile, getCursorProfilesDir, getCursorHomeDir, getCursorHomeSettingsFile, getCursorSkillsDir, getCursorAgentsMdFile) in @/src/cli/env.ts parallel the existing Claude path helpers.

### Core Implementation

**CursorLoaderRegistry** (cursorLoaderRegistry.ts): Singleton registry managing top-level Cursor feature loaders. Registers only the cursorProfilesLoader which orchestrates all profile-related installation.

**CursorProfileLoaderRegistry** (profiles/cursorProfileLoaderRegistry.ts): Singleton registry managing profile-dependent loaders that must run after profiles are installed. Registration order matters - skills loader runs before agentsmd loader (which reads from skills).

**Cursor Profiles Loader** (profiles/loader.ts): Installs profile templates to `~/.cursor/profiles/`. Key behaviors:
- Reuses profile templates from @/src/cli/features/profiles/config/ (no separate Cursor templates)
- Applies mixin composition logic identical to the Claude profiles loader
- After installing profiles, invokes all CursorProfileLoaderRegistry loaders
- Configures permissions by updating `~/.cursor/settings.json` with additionalDirectories

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

### Things to Know

The cursor profiles loader implements the `Loader` interface from @/src/cli/features/loaderRegistry.ts. Profile-dependent loaders (skills, agentsmd) use the `CursorProfileLoader` interface with `install`/`uninstall` methods. The loader hierarchy ensures:
- Profiles installed first (creates ~/.cursor/profiles/{profile}/)
- Skills installed second (reads from profiles, creates ~/.cursor/skills/)
- AGENTS.md installed third (reads skills list for embedding)

Mixin composition injects conditional paid mixins based on config.auth presence. Profiles are composed from mixins in alphabetical order. During uninstall, only builtin profiles (identified by `"builtin": true` in profile.json) are removed, preserving user-created profiles.

The AGENTS.md managed block pattern allows users to add custom instructions outside the block without losing them during reinstalls. If AGENTS.md becomes empty after removing the managed block during uninstall, the file is deleted.

Created and maintained by Nori.
