/**
 * Environment paths and constants for installer
 * Centralized location for Claude-related paths
 */

import * as path from "path";
import { fileURLToPath } from "url";

/**
 * MCP root directory (where package.json is located)
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const MCP_ROOT = path.resolve(__dirname, "../../..");

/**
 * Claude directory path
 */
export const CLAUDE_DIR = path.join(process.env.HOME || "~", ".claude");

/**
 * Claude settings file path
 */
export const CLAUDE_SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");

/**
 * Claude agents directory
 */
export const CLAUDE_AGENTS_DIR = path.join(CLAUDE_DIR, "agents");

/**
 * Claude commands directory
 */
export const CLAUDE_COMMANDS_DIR = path.join(CLAUDE_DIR, "commands");

/**
 * CLAUDE.md file path
 */
export const CLAUDE_MD_FILE = path.join(CLAUDE_DIR, "CLAUDE.md");

/**
 * Claude skills directory
 */
export const CLAUDE_SKILLS_DIR = path.join(CLAUDE_DIR, "skills");

/**
 * Claude profiles directory
 */
export const CLAUDE_PROFILES_DIR = path.join(CLAUDE_DIR, "profiles");
