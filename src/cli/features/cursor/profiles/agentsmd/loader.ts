/**
 * Cursor AGENTS.md feature loader
 * Configures AGENTS.md with coding task instructions for Cursor IDE
 */

import * as fs from "fs/promises";
import * as path from "path";

import { glob } from "glob";

import { getCursorDir, getCursorAgentsMdFile } from "@/cli/env.js";
import { success, info } from "@/cli/logger.js";
import {
  formatInstallPath,
  substituteTemplatePaths,
} from "@/utils/template.js";

import type { Config } from "@/cli/config.js";
import type { CursorProfileLoader } from "@/cli/features/cursor/profiles/cursorProfileLoaderRegistry.js";
import type { ValidationResult } from "@/cli/features/loaderRegistry.js";

/**
 * Get path to AGENTS.md for a profile
 *
 * @param args - Function arguments
 * @param args.profileName - Name of the profile to load AGENTS.md from
 * @param args.installDir - Installation directory
 *
 * @returns Path to the AGENTS.md file for the profile
 */
const getProfileAgentsMd = (args: {
  profileName: string;
  installDir: string;
}): string => {
  const { profileName, installDir } = args;
  const cursorDir = getCursorDir({ installDir });
  return path.join(cursorDir, "profiles", profileName, "AGENTS.md");
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
 * Format skill information for display in AGENTS.md
 * @param args - Function arguments
 * @param args.skillPath - Path to SKILL.md file in config directory
 * @param args.installDir - Custom installation directory (.cursor path)
 *
 * @returns Formatted skill information or null if path doesn't match expected format
 */
const formatSkillInfo = async (args: {
  skillPath: string;
  installDir: string;
}): Promise<string | null> => {
  const { skillPath, installDir } = args;

  try {
    const content = await fs.readFile(skillPath, "utf-8");
    const frontMatter = extractFrontMatter({ content });

    // Extract the skill name from the path
    const pathParts = skillPath.split(path.sep);
    const skillMdIndex = pathParts.lastIndexOf("SKILL.md");
    if (skillMdIndex === -1 || skillMdIndex === 0) {
      return null;
    }

    // The skill name is the directory containing SKILL.md
    let skillName = pathParts[skillMdIndex - 1];
    // Strip paid- prefix from skill name to match actual installation
    skillName = skillName.replace(/^paid-/, "");

    // Format the installed path based on install directory
    const installedPath = formatInstallPath({
      installDir,
      subPath: `skills/${skillName}/SKILL.md`,
    });

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
 * Generate skills list content to embed in AGENTS.md
 *
 * @param args - Function arguments
 * @param args.profileName - Profile name to load skills from
 * @param args.installDir - Installation directory
 *
 * @returns Formatted skills list markdown (empty string if skills cannot be found)
 */
const generateSkillsList = async (args: {
  profileName: string;
  installDir: string;
}): Promise<string> => {
  const { profileName, installDir } = args;

  try {
    // Get skills directory for the profile from installed profiles
    const cursorDir = getCursorDir({ installDir });
    const skillsDir = path.join(cursorDir, "profiles", profileName, "skills");

    // Find all skill files
    const skillFiles = await findSkillFiles({ dir: skillsDir });

    if (skillFiles.length === 0) {
      return "";
    }

    // Format all skills
    const formattedSkills: Array<string> = [];
    for (const file of skillFiles) {
      const formatted = await formatSkillInfo({
        skillPath: file,
        installDir: cursorDir,
      });
      if (formatted != null) {
        formattedSkills.push(formatted);
      }
    }

    if (formattedSkills.length === 0) {
      return "";
    }

    // Build skills list message with correct path for the install directory
    const usingSkillsPath = formatInstallPath({
      installDir: cursorDir,
      subPath: "skills/using-skills/SKILL.md",
    });

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
 * Insert or update AGENTS.md with nori instructions in a managed block
 * @param args - Configuration arguments
 * @param args.config - Full configuration including profile
 */
const insertAgentsMd = async (args: { config: Config }): Promise<void> => {
  const { config } = args;

  info({ message: "Configuring AGENTS.md with coding task instructions..." });

  // Get profile name from config (default to senior-swe)
  const profileName = config.profile?.baseProfile || "senior-swe";

  // Get paths using installDir
  const cursorDir = getCursorDir({ installDir: config.installDir });
  const agentsMdFile = getCursorAgentsMdFile({ installDir: config.installDir });

  // Read AGENTS.md from the selected profile
  const profileAgentsMdPath = getProfileAgentsMd({
    profileName,
    installDir: config.installDir,
  });
  let instructions = await fs.readFile(profileAgentsMdPath, "utf-8");

  // Apply template substitution to replace placeholders with actual paths
  instructions = substituteTemplatePaths({
    content: instructions,
    installDir: cursorDir,
  });

  // Generate and append skills list
  const skillsList = await generateSkillsList({
    profileName,
    installDir: config.installDir,
  });
  if (skillsList.length > 0) {
    instructions = instructions + skillsList;
  }

  // Create .cursor directory if it doesn't exist
  await fs.mkdir(cursorDir, { recursive: true });

  // Read existing content or start with empty string
  let content = "";
  try {
    content = await fs.readFile(agentsMdFile, "utf-8");
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
    info({ message: "Updating existing nori instructions in AGENTS.md..." });
  } else {
    // Append new managed block
    const section = `\n${BEGIN_MARKER}\n${instructions}\n${END_MARKER}\n`;
    content = content + section;
    info({ message: "Adding nori instructions to AGENTS.md..." });
  }

  await fs.writeFile(agentsMdFile, content);
  success({ message: `✓ AGENTS.md configured at ${agentsMdFile}` });
};

/**
 * Remove nori-managed block from AGENTS.md
 *
 * @param args - Configuration arguments
 * @param args.config - Runtime configuration
 */
const removeAgentsMd = async (args: { config: Config }): Promise<void> => {
  const { config } = args;
  info({ message: "Removing nori instructions from AGENTS.md..." });

  const agentsMdFile = getCursorAgentsMdFile({ installDir: config.installDir });

  try {
    const content = await fs.readFile(agentsMdFile, "utf-8");

    // Check if managed block exists
    if (!content.includes(BEGIN_MARKER)) {
      info({ message: "No nori instructions found in AGENTS.md" });
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
      await fs.unlink(agentsMdFile);
      success({ message: "✓ AGENTS.md removed (was empty after cleanup)" });
    } else {
      await fs.writeFile(agentsMdFile, updated);
      success({
        message: "✓ Nori instructions removed from AGENTS.md (file preserved)",
      });
    }
  } catch {
    info({ message: "AGENTS.md not found (may not have been installed)" });
  }
};

/**
 * Validate AGENTS.md configuration
 *
 * @param args - Configuration arguments
 * @param args.config - Runtime configuration
 *
 * @returns Validation result
 */
const validate = async (args: {
  config: Config;
}): Promise<ValidationResult> => {
  const { config } = args;
  const errors: Array<string> = [];

  const agentsMdFile = getCursorAgentsMdFile({ installDir: config.installDir });

  // Check if AGENTS.md exists
  try {
    await fs.access(agentsMdFile);
  } catch {
    errors.push(`AGENTS.md not found at ${agentsMdFile}`);
    errors.push('Run "nori-ai install-cursor" to create AGENTS.md');
    return {
      valid: false,
      message: "Cursor AGENTS.md not found",
      errors,
    };
  }

  // Read and check for managed block
  let content: string;
  try {
    content = await fs.readFile(agentsMdFile, "utf-8");
  } catch (err) {
    errors.push("Failed to read AGENTS.md");
    errors.push(`Error: ${err}`);
    return {
      valid: false,
      message: "Unable to read AGENTS.md",
      errors,
    };
  }

  // Check if managed block exists
  if (!content.includes(BEGIN_MARKER) || !content.includes(END_MARKER)) {
    errors.push("Nori managed block not found in AGENTS.md");
    errors.push('Run "nori-ai install-cursor" to add managed block');
    return {
      valid: false,
      message: "Nori managed block missing",
      errors,
    };
  }

  return {
    valid: true,
    message: "Cursor AGENTS.md is properly configured",
    errors: null,
  };
};

/**
 * Cursor AGENTS.md feature loader
 */
export const cursorAgentsMdLoader: CursorProfileLoader = {
  name: "cursor-agentsmd",
  description: "Configure AGENTS.md with coding task instructions for Cursor",
  install: async (args: { config: Config }) => {
    const { config } = args;
    await insertAgentsMd({ config });
  },
  uninstall: async (args: { config: Config }) => {
    const { config } = args;
    await removeAgentsMd({ config });
  },
  validate,
};
