/**
 * Environment paths and constants for CLI
 * Contains only CLI-level concerns. Agent-specific paths are in their respective feature directories.
 */

import * as path from "path";
import { fileURLToPath } from "url";

/**
 * CLI root directory (where package.json is located)
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const CLI_ROOT = path.resolve(__dirname, "../../..");
