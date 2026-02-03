# Epic: Migrate CLI Prompts to @clack/prompts

## Overview

Replace the custom `promptUser()` implementation with `@clack/prompts` to provide a polished, modern CLI experience with better UX patterns (arrow-key selection, spinners, grouped prompts, etc.).

## Current State

### Prompting Infrastructure
- **File**: `src/cli/prompt.ts` (77 lines)
- **Library**: Raw Node.js `readline` with manual raw-mode handling for passwords
- **Pattern**: Single `promptUser({ prompt, hidden? })` function

### Testing Pattern
- Tests mock `promptUser` via `vi.mock("@/cli/prompt.js")`
- Mock returns are sequenced: `.mockResolvedValueOnce("value1").mockResolvedValueOnce("value2")`
- Tests verify behavior via filesystem state (config files created, profiles selected)

---

## Stepper Flows to Introduce

### Flow 1: Installation Wizard (`nori-skillsets install`)

**Steps**: init → onboard → switch-profile

```
┌─────────────────────────────────────────────────────┐
│  Welcome to Nori Skillsets                          │
└─────────────────────────────────────────────────────┘

◇ Step 1: Initialize
│ Creating .nori-config.json...
│ Creating .nori/profiles/...
└ Done

◆ Step 2: Configure (optional)
│
│ ○ Email: user@example.com
│ ○ Password: ********
│ ○ Organization ID: mycompany
│
└ Authenticated successfully

◆ Step 3: Select Profile
│
│ ● senior-swe (Installed profile)
│ ○ product-manager (Installed profile)
│ ○ amol (Installed profile)
│
└ Selected: senior-swe

◇ Installing profile...
│ Loading skills...
│ Configuring hooks...
└ Done

└ Installation complete!
```

**@clack components**:
- `intro()` - Welcome banner
- `spinner()` - Progress indicators
- `group()` - Bundle auth prompts (email, password, org ID)
- `select()` - Profile selection with arrow keys
- `outro()` - Completion message

### Flow 2: Authentication Flow (`nori-skillsets login`)

**Current location**: `src/cli/commands/login/login.ts:255-261`

```
◆ Login to Nori Skillsets
│
│ ○ Email: user@example.com
│ ○ Password: ********
│
├ Authenticating...
└ Logged in as user@example.com
```

**@clack components**:
- `text()` - Email input
- `password()` - Password input (masked)
- `spinner()` - Auth progress
- `note()` - Display organization access info

### Flow 3: Profile Switch (`nori-skillsets switch-skillset`)

**Current location**: `src/cli/commands/switch-profile/profiles.ts:56-77, 119-123`

```
◆ Switch Skillset
│
│ Multiple agents installed:
│ ● claude-code (Claude Code)
│ ○ cursor-agent (Cursor)
│
├ Selected: claude-code
│
│ Current: senior-swe → New: product-manager
│
◆ Proceed with switch? (Y/n)
│
└ Switched to: product-manager
```

**@clack components**:
- `select()` - Agent selection (when multiple installed)
- `confirm()` - Switch confirmation
- `spinner()` - Reinstall progress

### Flow 4: Existing Config Capture (`init` with existing `.claude/`)

**Current location**: `src/cli/commands/install/existingConfigCapture.ts:360-374`

```
◆ Existing Configuration Detected
│
│ Found:
│   • CLAUDE.md
│   • 3 skills
│   • 2 subagents
│
◆ Save as local skillset?
│
│ ○ Skillset name: my-workflow
│   (lowercase letters, numbers, hyphens)
│
└ Saved to ~/.nori/profiles/my-workflow/
```

**@clack components**:
- `note()` - Display detected config
- `text()` - Skillset name with validation callback

### Flow 5: Onboarding Auth + Profile Selection

**Current location**: `src/cli/commands/onboard/onboard.ts:64-218`

This is the most complex flow, combining auth and profile selection:

```
◆ Nori Web Configuration (optional)
│
│ If you have access to Nori Web, enter your credentials.
│ Learn more at usenori.ai
│
│ ○ Email (or press Enter to skip): user@example.com
│ ○ Password: ********
│ ○ Organization ID: mycompany
│
└ Authenticated

◆ Select Profile
│
│ Nori profiles contain a complete configuration for
│ customizing your coding agent.
│
│ ● senior-swe
│ ○ product-manager
│ ○ amol
│
└ Loading "senior-swe" profile...
```

**@clack components**:
- `group()` - Optional auth flow (email can be empty to skip)
- `select()` - Profile selection
- `spinner()` - Profile loading

---

## Code Structure After Refactoring

### New Module: `src/cli/prompts/`

```
src/cli/prompts/
├── index.ts           # Re-exports all prompts
├── auth.ts            # promptForAuth() using group()
├── profile.ts         # promptForProfile() using select()
├── confirm.ts         # confirmAction() using confirm()
├── text.ts            # promptText() with validation wrapper
└── utils.ts           # Shared utilities (cancel handling, etc.)
```

### File: `src/cli/prompts/index.ts`

```typescript
export { promptForAuth, type AuthCredentials } from "./auth.js";
export { promptForProfile, type ProfileSelection } from "./profile.js";
export { confirmAction } from "./confirm.js";
export { promptText, promptProfileName } from "./text.js";
export { handleCancel, isCancel } from "./utils.js";
```

### File: `src/cli/prompts/auth.ts`

```typescript
import { group, text, password, isCancel, cancel } from "@clack/prompts";
import { handleCancel } from "./utils.js";

export type AuthCredentials = {
  username: string;
  password: string;
  organizationUrl: string;
} | null;

export const promptForAuth = async (): Promise<AuthCredentials> => {
  const result = await group(
    {
      username: () =>
        text({
          message: "Email address (or press Enter to skip)",
          placeholder: "user@example.com",
        }),
      password: ({ results }) => {
        if (!results.username) return Promise.resolve(null);
        return password({
          message: "Password",
          mask: "*",
        });
      },
      organizationUrl: ({ results }) => {
        if (!results.username) return Promise.resolve(null);
        return text({
          message: "Organization ID",
          placeholder: "mycompany",
          validate: (value) => {
            if (!value) return "Organization ID is required";
            if (!/^[a-z0-9-]+$/.test(value)) {
              return "Use lowercase letters, numbers, and hyphens only";
            }
          },
        });
      },
    },
    {
      onCancel: () => handleCancel(),
    }
  );

  if (!result.username) return null;

  return {
    username: result.username,
    password: result.password!,
    organizationUrl: buildWatchtowerUrl({ orgId: result.organizationUrl! }),
  };
};
```

### File: `src/cli/prompts/profile.ts`

```typescript
import { select, isCancel } from "@clack/prompts";
import { handleCancel } from "./utils.js";

export type ProfileSelection = { baseProfile: string };

export const promptForProfile = async (args: {
  profiles: Array<{ name: string; description: string }>;
}): Promise<ProfileSelection> => {
  const { profiles } = args;

  const selected = await select({
    message: "Select a profile",
    options: profiles.map((p) => ({
      value: p.name,
      label: p.name,
      hint: p.description,
    })),
  });

  if (isCancel(selected)) handleCancel();

  return { baseProfile: selected as string };
};
```

### File: `src/cli/prompts/utils.ts`

```typescript
import { cancel, isCancel as clackIsCancel } from "@clack/prompts";

export const isCancel = clackIsCancel;

export const handleCancel = (): never => {
  cancel("Operation cancelled.");
  process.exit(0);
};
```

### Migration of Existing Commands

Each command file (`init.ts`, `onboard.ts`, `login.ts`, `profiles.ts`, `existingConfigCapture.ts`) will:

1. Replace `import { promptUser } from "@/cli/prompt.js"` with imports from `@/cli/prompts/`
2. Replace manual loops and numbered menus with `select()`
3. Replace y/n string checks with `confirm()`
4. Add `intro()` / `outro()` framing where appropriate
5. Add `spinner()` for async operations

### Deprecation of `src/cli/prompt.ts`

After migration is complete, delete `src/cli/prompt.ts`. All tests that mock it will instead mock the new `@/cli/prompts/` module functions.

---

## Automated Testing Strategy

### Approach: Mock @clack/prompts at Module Level

Tests will mock `@clack/prompts` rather than our wrapper functions. This tests our integration logic while avoiding actual TTY interactions.

### Test File Structure

```
src/cli/prompts/
├── auth.test.ts
├── profile.test.ts
├── confirm.test.ts
└── text.test.ts

src/cli/commands/onboard/
├── onboard.test.ts      # Integration tests for full flow
```

### Expected Behaviors Under Test

#### 1. Auth Flow (`auth.test.ts`)

| Test Case | Input Sequence | Expected Outcome |
|-----------|----------------|------------------|
| Skip auth | `group()` returns `{ username: "" }` | Returns `null` |
| Complete auth | `group()` returns `{ username: "user@example.com", password: "pass", organizationUrl: "myorg" }` | Returns `AuthCredentials` with built URL |
| Cancel during auth | `group()` throws cancel | Calls `process.exit(0)` |
| Invalid org ID | Validation rejects `"My Company"` | Validation error message returned |
| Valid org ID | Validation accepts `"my-company"` | No error |

#### 2. Profile Selection (`profile.test.ts`)

| Test Case | Input | Expected Outcome |
|-----------|-------|------------------|
| Select first profile | `select()` returns `"senior-swe"` | Returns `{ baseProfile: "senior-swe" }` |
| Select from multiple | `select()` returns `"product-manager"` | Returns correct selection |
| Cancel selection | `select()` returns cancel symbol | Calls `process.exit(0)` |
| Empty profiles list | `profiles: []` | Throws error before prompting |

#### 3. Confirmation (`confirm.test.ts`)

| Test Case | Input | Expected Outcome |
|-----------|-------|------------------|
| User confirms | `confirm()` returns `true` | Returns `true` |
| User declines | `confirm()` returns `false` | Returns `false` |
| User cancels | `confirm()` returns cancel symbol | Calls `process.exit(0)` |

#### 4. Text Input with Validation (`text.test.ts`)

| Test Case | Input | Expected Outcome |
|-----------|-------|------------------|
| Valid profile name | `"my-profile"` | Returns `"my-profile"` |
| Name with spaces | `"my profile"` | Validation error |
| Name with uppercase | `"My-Profile"` | Validation error |
| Empty name | `""` | Validation error |
| Cancel input | Cancel symbol | Calls `process.exit(0)` |

### Integration Test Pattern

```typescript
// src/cli/commands/onboard/onboard.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as clack from "@clack/prompts";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  group: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
}));

describe("onboard command with @clack/prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full onboard flow with auth and profile selection", async () => {
    // Arrange: Mock the sequence of prompts
    vi.mocked(clack.group).mockResolvedValueOnce({
      username: "test@example.com",
      password: "password123",
      organizationUrl: "myorg",
    });
    vi.mocked(clack.select).mockResolvedValueOnce("senior-swe");

    // Act: Run onboard
    await onboardMain({ installDir: tempDir, agent: "claude-code" });

    // Assert: Verify prompts were called
    expect(clack.group).toHaveBeenCalledTimes(1);
    expect(clack.select).toHaveBeenCalledTimes(1);

    // Assert: Verify config was saved correctly
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    expect(config.auth.username).toBe("test@example.com");
    expect(config.agents["claude-code"].profile.baseProfile).toBe("senior-swe");
  });

  it("should skip auth when user provides empty email", async () => {
    // Arrange: Mock empty email (skip auth)
    vi.mocked(clack.group).mockResolvedValueOnce({
      username: "",
    });
    vi.mocked(clack.select).mockResolvedValueOnce("senior-swe");

    // Act
    await onboardMain({ installDir: tempDir, agent: "claude-code" });

    // Assert: Config should have no auth
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    expect(config.auth).toBeUndefined();
  });

  it("should exit gracefully on cancel", async () => {
    // Arrange: Mock cancel during group
    vi.mocked(clack.group).mockRejectedValueOnce(new Error("cancelled"));
    vi.mocked(clack.isCancel).mockReturnValue(true);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    // Act & Assert
    await expect(
      onboardMain({ installDir: tempDir, agent: "claude-code" })
    ).rejects.toThrow("exit");

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
```

### Non-Interactive Mode Tests

Non-interactive mode should bypass all @clack prompts:

```typescript
it("should not call any prompts in non-interactive mode", async () => {
  await onboardMain({
    installDir: tempDir,
    nonInteractive: true,
    profile: "senior-swe",
    agent: "claude-code",
  });

  // No prompts should be called
  expect(clack.group).not.toHaveBeenCalled();
  expect(clack.select).not.toHaveBeenCalled();
  expect(clack.confirm).not.toHaveBeenCalled();
});
```

### Validation Function Tests

Validation functions should be extracted and tested in isolation:

```typescript
// src/cli/prompts/validators.ts
export const validateProfileName = (value: string): string | undefined => {
  if (!value || value.trim() === "") {
    return "Profile name is required";
  }
  if (!/^[a-z0-9-]+$/.test(value)) {
    return "Use lowercase letters, numbers, and hyphens only";
  }
  return undefined; // Valid
};

// src/cli/prompts/validators.test.ts
describe("validateProfileName", () => {
  it("returns error for empty string", () => {
    expect(validateProfileName("")).toBe("Profile name is required");
  });

  it("returns error for uppercase letters", () => {
    expect(validateProfileName("MyProfile")).toBe(
      "Use lowercase letters, numbers, and hyphens only"
    );
  });

  it("returns error for spaces", () => {
    expect(validateProfileName("my profile")).toBe(
      "Use lowercase letters, numbers, and hyphens only"
    );
  });

  it("returns undefined for valid name", () => {
    expect(validateProfileName("my-profile-123")).toBeUndefined();
  });
});
```

---

## Migration Checklist

### Phase 1: Setup
- [ ] Add `@clack/prompts` dependency
- [ ] Create `src/cli/prompts/` directory structure
- [ ] Implement `utils.ts` with cancel handling

### Phase 2: Core Prompts
- [ ] Implement `text.ts` with validation wrapper
- [ ] Implement `confirm.ts`
- [ ] Implement `profile.ts` with select
- [ ] Implement `auth.ts` with group
- [ ] Add tests for each prompt module

### Phase 3: Command Migration (in order of complexity)
- [ ] `login.ts` - Simplest (2 prompts)
- [ ] `init.ts` - Single confirmation
- [ ] `existingConfigCapture.ts` - Text with validation
- [ ] `switch-profile/profiles.ts` - Select + confirm
- [ ] `onboard.ts` - Full flow (most complex)

### Phase 4: Cleanup
- [ ] Delete `src/cli/prompt.ts`
- [ ] Update all test mocks to use @clack/prompts
- [ ] Add spinners to async operations
- [ ] Add intro/outro framing to commands

### Phase 5: Polish
- [ ] Ensure consistent styling across all flows
- [ ] Test on both macOS and Linux terminals
- [ ] Verify non-interactive mode still works
- [ ] Update any documentation referencing old prompts

---

## Dependencies

```json
{
  "dependencies": {
    "@clack/prompts": "^0.7.0"
  }
}
```

## References

- [@clack/prompts documentation](https://github.com/natemoo-re/clack)
- [Current prompt implementation](src/cli/prompt.ts)
- [Existing test patterns](src/cli/commands/onboard/onboard.test.ts)
