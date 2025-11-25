---
name: Creating-Skills
description: Use when you need to create a new custom skill for a profile - guides through gathering requirements, creating directory structure, writing SKILL.md, and optionally adding bundled scripts
---

<required>
*CRITICAL* Add the following steps to your Todo list using TodoWrite:

1. Gather skill requirements from the user
2. Select target profile
3. Create skill directory structure
4. Write SKILL.md with proper frontmatter
5. (Optional) Add bundled scripts if needed
6. Verify skill was created
7. Offer to switch profiles
</required>

# Creating Custom Skills

## Overview

This skill guides you through creating custom skills that persist across sessions. Skills are stored in profile directories and can include markdown instructions, checklists, and optional bundled scripts.

**Announce at start:** "I'm using the Creating-Skills skill to help you create a new custom skill."

## The Process

### Phase 1: Gather Skill Requirements

Use AskUserQuestion to gather:

1. **Skill name** (alphanumeric, hyphens, underscores only)
2. **Skill description** (1-2 sentences for the frontmatter)
3. **Required steps** - What should the skill guide the user to do?
4. **Additional guidelines** - Any specific rules, patterns, or best practices?
5. **Bundled scripts needed?** - Does this skill need executable scripts?

### Phase 2: Select Target Profile

1. List available profiles:
   ```bash
   ls -1 {{nori_install_dir}}/.claude/profiles/
   ```

2. Use AskUserQuestion to let user choose which profile should get the skill

3. Validate the profile exists

### Phase 3: Create Skill Directory

Create the skill directory:
```bash
mkdir -p {{nori_install_dir}}/.claude/profiles/{selected-profile}/skills/{skill-name}
```

### Phase 4: Write SKILL.md

Create the SKILL.md file with this structure:

```markdown
---
name: Skill-Name
description: Brief description of when to use this skill
---

<required>
*CRITICAL* Add the following steps to your Todo list using TodoWrite:

1. [Step 1]
2. [Step 2]
...
</required>

# Skill Title

## Overview

[Describe what the skill does and when to use it]

## Process

[Detail the workflow, phases, or steps]

## Examples

[Provide examples if helpful]
```

**Important formatting:**
- YAML frontmatter must be at the top between `---` delimiters
- `name:` and `description:` fields are required
- Use `<required>` blocks for checklist-based workflows
- Reference other skills using `{{skills_dir}}/skill-name`
- Reference profiles directory using `{{nori_install_dir}}/.claude/profiles/`

### Phase 5: Add Bundled Scripts (Optional)

If the user requested bundled scripts:

1. Explain that bundled scripts:
   - Require TypeScript knowledge
   - Must be in the paid tier profiles
   - Need to follow the bundling pattern (see existing paid skills like `recall` or `memorize`)
   - Require tests (script.test.ts)

2. Create script files:
   ```bash
   touch {{nori_install_dir}}/.claude/profiles/{profile}/skills/{skill-name}/script.ts
   touch {{nori_install_dir}}/.claude/profiles/{profile}/skills/{skill-name}/script.test.ts
   ```

3. Guide the user through writing the script with proper imports and structure

4. **Important:** Scripts in profiles are NOT automatically bundled. The user must:
   - Copy the skill to the plugin package source if they want it bundled
   - OR manually bundle it themselves
   - OR use it as an unbundled Node.js script

### Phase 6: Verify Skill Was Created

Check that the skill exists:
```bash
ls -la {{nori_install_dir}}/.claude/profiles/{profile}/skills/{skill-name}/
cat {{nori_install_dir}}/.claude/profiles/{profile}/skills/{skill-name}/SKILL.md
```

Display the full path to the user and confirm the frontmatter is correct.

### Phase 7: Offer to Switch Profiles

Use AskUserQuestion to ask if the user wants to switch to the profile containing the new skill.

If yes:
- Use the SlashCommand tool to run `/nori-switch-profile {profile-name}`
- The skill will be immediately available after the profile switch

If the user is already on the target profile:
- Skip this step and inform them the skill is now available

## Skill Name Validation

Valid skill names:
- Lowercase letters, numbers, hyphens, underscores
- No spaces or special characters
- Examples: `my-skill`, `debugging-helpers`, `test_utils`

Invalid examples: `My Skill`, `skill!`, `skill.name`

## Edge Cases

**Skill already exists:**
- Check if directory exists first
- Ask user if they want to overwrite
- Warn that overwriting will delete existing content

**Profile is built-in:**
- Built-in profiles (builtin: true) get overwritten on reinstall
- Warn user that custom skills in built-in profiles will be lost
- Suggest creating a custom profile or accepting the risk

**User on free tier wants paid skill scripts:**
- Explain scripts require paid tier profiles
- Guide them to create simple markdown-only skill instead

## Template Variables

These variables are automatically substituted when skills are installed:
- `{{skills_dir}}` → actual path to skills directory (e.g., `/home/user/.claude/skills`)
- `{{nori_install_dir}}` → actual install directory (e.g., `/home/user`)

Use these in your skill content to create portable paths.

## Examples

### Simple Checklist Skill

```markdown
---
name: My-Workflow
description: Use when following my custom development workflow
---

<required>
*CRITICAL* Add the following steps to your Todo list using TodoWrite:

1. Check current branch
2. Create feature branch
3. Write failing test
4. Implement feature
5. Verify tests pass
6. Commit changes
</required>

# My Custom Workflow

Follow these steps for every feature implementation...
```

### Interactive Skill with Phases

```markdown
---
name: Debug-Helper
description: Use when debugging complex issues systematically
---

<required>
*CRITICAL* Add the following steps to your Todo list using TodoWrite:

1. Reproduce the issue
2. Add logging
3. Analyze logs
4. Form hypothesis
5. Test hypothesis
6. Implement fix
</required>

# Systematic Debugging

## Phase 1: Reproduction

[Details...]

## Phase 2: Investigation

[Details...]
```

## Remember

- Always validate skill names (no spaces, special characters)
- Check if skill already exists before creating
- Verify frontmatter format (YAML with name and description)
- Use TodoWrite for checklist-based skills
- Reference template variables for portable paths
- Offer to switch profiles after creation
- Let users iterate on the skill content
