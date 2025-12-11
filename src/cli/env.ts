/**
 * Environment paths and constants for CLI
 * Contains only CLI-level concerns. Agent-specific paths are in their respective feature directories.
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
 * Re-export Claude Code specific paths for backward compatibility.
 * New code within cli/features/claude-code/ should import directly from ./paths.js
 */
export {
  getClaudeDir,
  getClaudeSettingsFile,
  getClaudeAgentsDir,
  getClaudeCommandsDir,
  getClaudeMdFile,
  getClaudeSkillsDir,
  getClaudeProfilesDir,
  getClaudeHomeDir,
  getClaudeHomeSettingsFile,
} from "@/cli/features/claude-code/paths.js";
