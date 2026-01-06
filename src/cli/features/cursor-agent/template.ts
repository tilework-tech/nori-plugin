/**
 * Template substitution utility for Cursor Agent
 * Replaces placeholders with actual paths in content
 */

import * as fs from "fs/promises";
import * as path from "path";

import { getNoriProfilesDir } from "@/cli/features/claude-code/paths.js";

/**
 * Substitute template placeholders in content with actual paths
 *
 * Supported placeholders:
 * - {{rules_dir}} - Path to rules directory (~/.cursor/rules)
 * - {{profiles_dir}} - Path to profiles directory (~/.nori/profiles)
 * - {{commands_dir}} - Path to commands directory (~/.cursor/commands)
 * - {{subagents_dir}} - Path to subagents directory (~/.cursor/subagents)
 * - {{install_dir}} - Path to install root (parent of .cursor)
 *
 * @param args - Arguments object
 * @param args.content - The content with placeholders
 * @param args.installDir - The .cursor directory path
 *
 * @returns Content with placeholders replaced
 */
export const substituteTemplatePaths = (args: {
  content: string;
  installDir: string;
}): string => {
  const { content, installDir } = args;

  // The installDir is the .cursor directory, but profiles are in .nori/profiles
  // We need to get the parent directory to compute the nori profiles path
  const parentDir = path.dirname(installDir);
  const profilesDir = getNoriProfilesDir({ installDir: parentDir });

  return content
    .replace(/\{\{rules_dir\}\}/g, path.join(installDir, "rules"))
    .replace(/\{\{profiles_dir\}\}/g, profilesDir)
    .replace(/\{\{commands_dir\}\}/g, path.join(installDir, "commands"))
    .replace(/\{\{subagents_dir\}\}/g, path.join(installDir, "subagents"))
    .replace(/\{\{install_dir\}\}/g, parentDir);
};

/**
 * Copy a directory recursively, applying template substitution to markdown files
 *
 * @param args - Copy arguments
 * @param args.src - Source directory path
 * @param args.dest - Destination directory path
 * @param args.installDir - Installation directory for template substitution
 */
export const copyDirWithTemplateSubstitution = async (args: {
  src: string;
  dest: string;
  installDir: string;
}): Promise<void> => {
  const { src, dest, installDir } = args;

  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirWithTemplateSubstitution({
        src: srcPath,
        dest: destPath,
        installDir,
      });
    } else if (entry.name.endsWith(".md")) {
      // Apply template substitution to markdown files
      const content = await fs.readFile(srcPath, "utf-8");
      const substituted = substituteTemplatePaths({ content, installDir });
      await fs.writeFile(destPath, substituted);
    } else {
      // Copy other files directly
      await fs.copyFile(srcPath, destPath);
    }
  }
};
