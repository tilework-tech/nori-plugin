/**
 * CLAUDE.md feature loader
 * Configures CLAUDE.md with coding task instructions
 */

import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

import { glob } from "glob";

import { CLAUDE_DIR, CLAUDE_MD_FILE } from "@/installer/env.js";
import { success, info } from "@/installer/logger.js";

import type { Config } from "@/installer/config.js";
import type {
  Loader,
  ValidationResult,
} from "@/installer/features/loaderRegistry.js";

// Get directory of this loader file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get path to CLAUDE.md for a profile
 *
 * @param args - Function arguments
 * @param args.profileName - Name of the profile to load CLAUDE.md from
 *
 * @returns Path to the CLAUDE.md file for the profile
 */
const getProfileClaudeMd = (args: { profileName: string }): string => {
  const { profileName } = args;
  return path.join(CLAUDE_DIR, "profiles", profileName, "CLAUDE.md");
};

/**
 * Extract front matter from markdown file content
 * @param args - Function arguments
 * @param args.content - Markdown file content
 *
 * @returns Front matter object or null
 */
const extractFrontMatter = (args: {
  content: string;
}): Record<string, string> | null => {
  const { content } = args;

  const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontMatterRegex);

  if (match == null) {
    return null;
  }

  const frontMatter: Record<string, string> = {};

  if (match[1].trim() === "") {
    return frontMatter;
  }

  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.substring(1, value.length - 1);
    }

    frontMatter[key] = value;
  }

  return frontMatter;
};

/**
 * Find all SKILL.md files in a directory using glob pattern
 *
 * INVARIANT: All skill files MUST be named "SKILL.md"
 * If this naming convention changes, this function must be updated.
 *
 * @param args - Function arguments
 * @param args.dir - Directory to search
 *
 * @returns Array of skill file paths
 */
const findSkillFiles = async (args: {
  dir: string;
}): Promise<Array<string>> => {
  const { dir } = args;

  // Use glob to find all SKILL.md files recursively
  const files = await glob("**/SKILL.md", {
    cwd: dir,
    absolute: true,
    nodir: true,
  });

  return files;
};

/**
 * Format skill information for display in CLAUDE.md
 * @param args - Function arguments
 * @param args.skillPath - Path to SKILL.md file in config directory
 *
 * @returns Formatted skill information or null if path doesn't match expected format
 */
const formatSkillInfo = async (args: {
  skillPath: string;
}): Promise<string | null> => {
  const { skillPath } = args;

  try {
    const content = await fs.readFile(skillPath, "utf-8");
    const frontMatter = extractFrontMatter({ content });

    // Extract the skill name from the path
    // Path format: .../profiles/config/{profile}/skills/{skill-name}/SKILL.md
    // The skillPath is an absolute path, so we need to extract just the skill directory name
    const pathParts = skillPath.split(path.sep);
    const skillMdIndex = pathParts.lastIndexOf("SKILL.md");
    if (skillMdIndex === -1 || skillMdIndex === 0) {
      return null;
    }

    // The skill name is the directory containing SKILL.md
    let skillName = pathParts[skillMdIndex - 1];
    // Strip paid- prefix from skill name to match actual installation
    skillName = skillName.replace(/^paid-/, "");

    // Use tilde notation for the installed path
    const installedPath = `~/.claude/skills/${skillName}/SKILL.md`;

    let output = `\n${installedPath}`;

    if (frontMatter != null) {
      if (frontMatter.name != null) {
        output += `\n  Name: ${frontMatter.name}`;
      }
      if (frontMatter.description != null) {
        output += `\n  Description: ${frontMatter.description}`;
      }
    }

    return output;
  } catch {
    // If we can't read or parse the skill file, skip it
    return null;
  }
};

/**
 * Generate skills list content to embed in CLAUDE.md
 *
 * @param args - Function arguments
 * @param args.profileName - Profile name to load skills from
 *
 * @returns Formatted skills list markdown (empty string if skills cannot be found)
 */
const generateSkillsList = async (args: {
  profileName: string;
}): Promise<string> => {
  const { profileName } = args;

  try {
    // Get skills directory for the profile from installed profiles
    const skillsDir = path.join(CLAUDE_DIR, "profiles", profileName, "skills");

    // Find all skill files
    const skillFiles = await findSkillFiles({ dir: skillsDir });

    if (skillFiles.length === 0) {
      return "";
    }

    // Format all skills
    const formattedSkills: Array<string> = [];
    for (const file of skillFiles) {
      const formatted = await formatSkillInfo({ skillPath: file });
      if (formatted != null) {
        formattedSkills.push(formatted);
      }
    }

    if (formattedSkills.length === 0) {
      return "";
    }

    // Build skills list message
    const usingSkillsPath = "~/.claude/skills/using-skills/SKILL.md";

    const contextMessage = `
# Nori Skills System

You have access to the Nori skills system. Read the full instructions at: ${usingSkillsPath}

## Available Skills

Found ${formattedSkills.length} skills:${formattedSkills.join("")}

Check if any of these skills are relevant to the user's task. If relevant, use the Read tool to load the skill before proceeding.
`;

    return contextMessage;
  } catch {
    // If we can't find or read skills, silently return empty string
    // Installation will continue without skills list
    return "";
  }
};

// Markers for managed block
const BEGIN_MARKER = "# BEGIN NORI-AI MANAGED BLOCK";
const END_MARKER = "# END NORI-AI MANAGED BLOCK";

/**
 * Insert or update CLAUDE.md with nori instructions in a managed block
 * @param args - Configuration arguments
 * @param args.config - Full configuration including profile
 */
const insertClaudeMd = async (args: { config: Config }): Promise<void> => {
  const { config } = args;

  info({ message: "Configuring CLAUDE.md with coding task instructions..." });

  // Get profile name from config (default to senior-swe)
  const profileName = config.profile?.baseProfile || "senior-swe";

  // Read CLAUDE.md from the selected profile
  const profileClaudeMdPath = getProfileClaudeMd({ profileName });
  let instructions = await fs.readFile(profileClaudeMdPath, "utf-8");

  // Generate and append skills list
  const skillsList = await generateSkillsList({ profileName });
  if (skillsList.length > 0) {
    instructions = instructions + skillsList;
  }

  // Create .claude directory if it doesn't exist
  await fs.mkdir(CLAUDE_DIR, { recursive: true });

  // Read existing content or start with empty string
  let content = "";
  try {
    content = await fs.readFile(CLAUDE_MD_FILE, "utf-8");
  } catch {
    // File doesn't exist, will create it
  }

  // Check if managed block already exists
  if (content.includes(BEGIN_MARKER)) {
    // Replace existing managed block
    const regex = new RegExp(
      `${BEGIN_MARKER}\n[\\s\\S]*?\n${END_MARKER}\n?`,
      "g",
    );
    content = content.replace(
      regex,
      `${BEGIN_MARKER}\n${instructions}\n${END_MARKER}\n`,
    );
    info({ message: "Updating existing nori instructions in CLAUDE.md..." });
  } else {
    // Append new managed block
    const section = `\n${BEGIN_MARKER}\n${instructions}\n${END_MARKER}\n`;
    content = content + section;
    info({ message: "Adding nori instructions to CLAUDE.md..." });
  }

  await fs.writeFile(CLAUDE_MD_FILE, content);
  success({ message: `✓ CLAUDE.md configured at ${CLAUDE_MD_FILE}` });
};

/**
 * Remove nori-managed block from CLAUDE.md
 */
const removeClaudeMd = async (): Promise<void> => {
  info({ message: "Removing nori instructions from CLAUDE.md..." });

  try {
    const content = await fs.readFile(CLAUDE_MD_FILE, "utf-8");

    // Check if managed block exists
    if (!content.includes(BEGIN_MARKER)) {
      info({ message: "No nori instructions found in CLAUDE.md" });
      return;
    }

    // Remove managed block
    const regex = new RegExp(
      `\n?${BEGIN_MARKER}\n[\\s\\S]*?\n${END_MARKER}\n?`,
      "g",
    );
    const updated = content.replace(regex, "");

    // If file is empty after removal, delete it
    if (updated.trim() === "") {
      await fs.unlink(CLAUDE_MD_FILE);
      success({ message: "✓ CLAUDE.md removed (was empty after cleanup)" });
    } else {
      await fs.writeFile(CLAUDE_MD_FILE, updated);
      success({
        message: "✓ Nori instructions removed from CLAUDE.md (file preserved)",
      });
    }
  } catch {
    info({ message: "CLAUDE.md not found (may not have been installed)" });
  }
};

/**
 * Validate CLAUDE.md configuration
 *
 * @returns Validation result
 */
const validate = async (): Promise<ValidationResult> => {
  const errors: Array<string> = [];

  // Check if CLAUDE.md exists
  try {
    await fs.access(CLAUDE_MD_FILE);
  } catch {
    errors.push(`CLAUDE.md not found at ${CLAUDE_MD_FILE}`);
    errors.push('Run "nori-ai install" to create CLAUDE.md');
    return {
      valid: false,
      message: "CLAUDE.md not found",
      errors,
    };
  }

  // Read and check for managed block
  let content: string;
  try {
    content = await fs.readFile(CLAUDE_MD_FILE, "utf-8");
  } catch (err) {
    errors.push("Failed to read CLAUDE.md");
    errors.push(`Error: ${err}`);
    return {
      valid: false,
      message: "Unable to read CLAUDE.md",
      errors,
    };
  }

  // Check if managed block exists
  if (!content.includes(BEGIN_MARKER) || !content.includes(END_MARKER)) {
    errors.push("Nori managed block not found in CLAUDE.md");
    errors.push('Run "nori-ai install" to add managed block');
    return {
      valid: false,
      message: "Nori managed block missing",
      errors,
    };
  }

  return {
    valid: true,
    message: "CLAUDE.md is properly configured",
    errors: null,
  };
};

/**
 * CLAUDE.md feature loader
 */
export const claudeMdLoader: Loader = {
  name: "claudemd",
  description: "Configure CLAUDE.md with coding task instructions",
  run: async (args: { config: Config }) => {
    const { config } = args;
    await insertClaudeMd({ config });
  },
  uninstall: async (_args: { config: Config }) => {
    await removeClaudeMd();
  },
  validate,
};
