# Noridoc: features

Path: @/src/cli/features

### Overview

Multi-agent abstraction layer that defines the Agent interface and registry for supporting multiple AI agents (Claude Code, Cursor, etc.) through a unified CLI interface. Each agent implementation provides its own LoaderRegistry and profile management methods.

### How it fits into the larger codebase

The features directory sits between the CLI commands (@/src/cli/commands/) and agent-specific implementations (e.g., @/src/cli/features/claude-code/). CLI commands use the AgentRegistry to look up agent implementations by name, then delegate to the agent's loaders and profile methods.

```
CLI Commands (install, uninstall, check, switch-profile)
    |
    +-- AgentRegistry.getInstance().get({ name: agentName })
    |
    +-- Agent interface
        |
        +-- getLoaderRegistry() --> LoaderRegistry with agent's loaders
        +-- listProfiles({ installDir }) --> Available profile names
        +-- switchProfile({ installDir, profileName }) --> Validate and switch
```

The `--agent` global CLI option (default: "claude-code") determines which agent implementation is used. Per-agent profile configuration is stored in the Config `agents` field.

### Core Implementation

**Agent Interface** (agentRegistry.ts):
- `name`: Unique identifier (e.g., "claude-code")
- `displayName`: Human-readable name (e.g., "Claude Code")
- `getLoaderRegistry()`: Returns the agent's LoaderRegistry
- `listProfiles({ installDir })`: Returns array of available profile names for this agent
- `switchProfile({ installDir, profileName })`: Validates profile exists and updates config

**AgentRegistry** (agentRegistry.ts):
- Singleton pattern with `getInstance()`
- `get({ name })`: Look up agent by name, throws if not found
- `list()`: Returns array of registered agent names
- `resetInstance()`: For test isolation

### Things to Know

The AgentRegistry auto-registers all agents in its constructor. Currently only claude-code is registered, but the architecture supports adding new agents by:
1. Creating a new directory (e.g., `cursor/`) with an agent implementation
2. Importing and registering it in AgentRegistry's constructor

Commands that use loaders should obtain them via the agent rather than importing LoaderRegistry directly. This ensures the correct agent's loaders are used when `--agent` is specified.

Profile management is owned by the Agent interface. The `listProfiles` method scans the agent's profiles directory for valid profiles (directories containing the agent's instruction file). The `switchProfile` method validates the profile exists, updates the config, and logs success/restart messages. CLI commands add additional behavior on top (e.g., applying changes immediately via reinstall).

Agent implementations manage their own internal paths (config directories, instruction file names, etc.) without exposing them through the public interface. This keeps the abstraction clean and allows each agent to have different directory structures. For example, Claude Code's path helpers (getClaudeDir, getClaudeSkillsDir, etc.) live in @/src/cli/features/claude-code/paths.ts rather than in the CLI-level @/src/cli/env.ts. The env.ts file re-exports these functions for backward compatibility, but new code within agent directories should import from the agent's own paths module.

Created and maintained by Nori.
