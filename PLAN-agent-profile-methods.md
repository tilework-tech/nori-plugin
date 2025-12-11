# Agent Profile Methods Implementation Plan

**Goal:** Move `listProfiles` and `switchProfile` logic from CLI into the Agent interface, making profile management an agent-specific concern.

**Architecture:** Extend the `Agent` interface with `listProfiles` and `switchProfile` methods. The Claude Code agent will implement these using its knowledge of CLAUDE.md files and the config system. The CLI `switch-profile` command becomes a thin wrapper that delegates to the agent and shows available profiles on error.

**Tech Stack:** TypeScript, existing config system (`loadConfig`/`saveConfig`), fs/promises

---

## Testing Plan

I will add unit tests for the new agent methods in `src/cli/features/agentRegistry.test.ts`:

1. **listProfiles test**: Create a temp directory with profiles (directories containing CLAUDE.md), verify the method returns correct profile names
2. **switchProfile success test**: Create profiles, call switchProfile, verify config is updated with new profile
3. **switchProfile failure test**: Call switchProfile with non-existent profile, verify it throws an error

I will update the existing CLI tests in `src/cli/commands/switch-profile/profiles.test.ts` to verify the CLI correctly delegates to agent methods.

NOTE: I will write *all* tests before I add any implementation behavior.

---

## Step 1: Update Agent Interface

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-agent-abstraction/src/cli/features/agentRegistry.ts`

Remove `AgentEnvPaths` type and `getEnvPaths` method. Add new methods:

```typescript
export type Agent = {
  name: string;
  displayName: string;
  getLoaderRegistry: () => LoaderRegistry;
  listProfiles: (args: { installDir: string }) => Promise<string[]>;
  switchProfile: (args: { installDir: string; profileName: string }) => Promise<void>;
};
```

## Step 2: Write Failing Tests for Agent Methods

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-agent-abstraction/src/cli/features/agentRegistry.test.ts`

Add tests:
1. "claude-code agent lists profiles correctly" - creates temp profiles dir with profiles, calls `agent.listProfiles()`, expects array of profile names
2. "claude-code agent switchProfile updates config" - creates temp profiles, calls `agent.switchProfile()`, verifies config updated
3. "claude-code agent switchProfile throws for invalid profile" - calls with non-existent profile, expects error

Run tests: `npm test -- src/cli/features/agentRegistry.test.ts`
Expected: Tests fail (methods not implemented)

## Step 3: Implement Claude Code Agent Profile Methods

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-agent-abstraction/src/cli/features/claude-code/agent.ts`

Implement `listProfiles`:
- Get profiles directory path (`{installDir}/.claude/profiles`)
- Read directory entries
- Filter to directories containing `CLAUDE.md`
- Return array of profile names

Implement `switchProfile`:
- Get profiles directory path
- Check profile exists (directory with CLAUDE.md)
- If not, throw error with profile name
- Load current config
- Update config with new profile for this agent
- Save config
- Log success message

Run tests: `npm test -- src/cli/features/agentRegistry.test.ts`
Expected: Tests pass

## Step 4: Update CLI switch-profile Command

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-agent-abstraction/src/cli/commands/switch-profile/profiles.ts`

Remove `listProfiles` and `switchProfile` implementations from CLI.

Update `registerSwitchProfileCommand`:
```typescript
.action(async (name: string) => {
  const globalOpts = program.opts();
  const installDir = normalizeInstallDir({ installDir: globalOpts.installDir });
  const agentName = globalOpts.agent || "claude-code";
  const agent = AgentRegistry.getInstance().get({ name: agentName });

  try {
    await agent.switchProfile({ installDir, profileName: name });
  } catch (error) {
    // On failure, show available profiles
    const profiles = await agent.listProfiles({ installDir });
    error({ message: `Available profiles: ${profiles.join(", ")}` });
    throw error;
  }

  // Run install in non-interactive mode...
});
```

Keep the exported `listProfiles` and `switchProfile` functions as thin wrappers that delegate to the agent (for backwards compatibility if needed elsewhere).

Run tests: `npm test -- src/cli/commands/switch-profile/profiles.test.ts`
Expected: Tests pass

## Step 5: Clean Up AgentEnvPaths

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-agent-abstraction/src/cli/features/agentRegistry.ts`

- Remove `AgentEnvPaths` type export
- Remove `getEnvPaths` from `Agent` type

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-agent-abstraction/src/cli/features/claude-code/agent.ts`

- Remove `getEnvPaths` method
- Keep internal path logic for use by `listProfiles` and `switchProfile`

Update any tests that reference `getEnvPaths` or `AgentEnvPaths`.

## Step 6: Run Full Test Suite

```bash
npm test
npm run format
npm run lint
```

Expected: All tests pass, no lint errors

## Step 7: Update Documentation

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-agent-abstraction/src/cli/features/docs.md`

Update to reflect new Agent interface (remove getEnvPaths, add listProfiles/switchProfile)

**File:** `/home/amol/code/nori/nori-profiles/.worktrees/multi-agent-abstraction/src/cli/features/claude-code/docs.md`

Update to document the new methods

## Step 8: Commit and Push

```bash
git add -A
git commit -m "Move profile management to Agent interface

- Add listProfiles and switchProfile methods to Agent interface
- Implement in Claude Code agent with CLAUDE.md detection
- Update CLI switch-profile to delegate to agent methods
- Remove AgentEnvPaths from public interface (now internal)"
git push
```

---

**Testing Details:** Tests verify actual behavior: that listProfiles returns correct profile names from a real directory structure, that switchProfile actually updates the config file on disk, and that invalid profiles produce errors. No mocking of the agent methods themselves.

**Implementation Details:**
- Agent now owns all profile logic (listing, validation, switching)
- CLI becomes a thin wrapper with error handling that shows available profiles
- `AgentEnvPaths` removed from public interface - internal implementation detail
- Profile detection uses CLAUDE.md presence (agent-specific knowledge)
- Config updates use existing `loadConfig`/`saveConfig` functions
- Backwards compatibility maintained via exported wrapper functions

**Additional Finding:** The intercepted slash command `nori-switch-profile.ts` has duplicated `listProfiles`/`switchProfile` logic. This will also be updated to use the agent methods.

**Resolved:**
1. Remove exported wrapper functions from `profiles.ts` - they're not imported elsewhere
2. Agent's `switchProfile` will log success messages via shared `logger.ts`
3. Update `nori-switch-profile.ts` intercepted slash command to use agent methods (eliminates duplication)

---
