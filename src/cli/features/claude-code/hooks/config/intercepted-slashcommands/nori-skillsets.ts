/**
 * Unified intercepted slash command for nori-skillsets CLI
 *
 * Intercepts /nori-skillsets <SUBCMD> and /sks <SUBCMD> commands
 * and executes them via the nori-skillsets CLI in non-interactive mode.
 */

import { spawn } from "child_process";

import type {
  HookInput,
  HookOutput,
  InterceptedSlashCommand,
} from "./types.js";

import { formatError, formatSuccess } from "./format.js";

/**
 * Execute nori-skillsets command and capture output
 *
 * @param args - The function arguments
 * @param args.subcommand - The subcommand to run
 * @param args.cmdArgs - Additional arguments
 * @param args.cwd - Working directory
 *
 * @returns Promise resolving to the command output
 */
const executeNoriSkillsets = (args: {
  subcommand: string;
  cmdArgs: Array<string>;
  cwd: string;
}): Promise<{ success: boolean; output: string }> => {
  const { subcommand, cmdArgs, cwd } = args;

  return new Promise((resolve) => {
    const fullArgs = ["--non-interactive", subcommand, ...cmdArgs];

    const proc = spawn("nori-skillsets", fullArgs, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      const output = (stdout + stderr).trim();
      resolve({
        success: code === 0,
        output: output || (code === 0 ? "Command completed" : "Command failed"),
      });
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        output: `Failed to execute nori-skillsets: ${err.message}`,
      });
    });
  });
};

/**
 * Parse command arguments from the prompt
 * Handles both quoted strings and unquoted arguments
 *
 * @param args - The function arguments
 * @param args.argsString - The arguments string to parse
 *
 * @returns Array of parsed arguments
 */
const parseArgs = (args: { argsString: string }): Array<string> => {
  const { argsString } = args;

  if (!argsString.trim()) {
    return [];
  }

  const result: Array<string> = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (const char of argsString) {
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
        if (current) {
          result.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
    } else if (char === " " || char === "\t") {
      if (current) {
        result.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
};

/**
 * Run the unified nori-skillsets command
 *
 * @param args - The function arguments
 * @param args.input - The hook input containing prompt and cwd
 *
 * @returns The hook output with command result
 */
const run = async (args: { input: HookInput }): Promise<HookOutput | null> => {
  const { input } = args;
  const { prompt, cwd } = input;

  const trimmedPrompt = prompt.trim();

  // Match /nori-skillsets <subcmd> [args...] or /sks <subcmd> [args...]
  const match = trimmedPrompt.match(/^\/(?:nori-skillsets|sks)(?:\s+(.*))?$/i);

  if (match == null) {
    return null;
  }

  const restOfCommand = (match[1] ?? "").trim();

  // If no subcommand provided, show help
  if (!restOfCommand) {
    const result = await executeNoriSkillsets({
      subcommand: "help",
      cmdArgs: [],
      cwd,
    });

    return {
      decision: "block",
      reason: formatSuccess({ message: result.output }),
    };
  }

  // Parse the subcommand and arguments
  const parsedArgs = parseArgs({ argsString: restOfCommand });

  if (parsedArgs.length === 0) {
    const result = await executeNoriSkillsets({
      subcommand: "help",
      cmdArgs: [],
      cwd,
    });

    return {
      decision: "block",
      reason: formatSuccess({ message: result.output }),
    };
  }

  const [subcommand, ...cmdArgs] = parsedArgs;

  // Execute the command
  const result = await executeNoriSkillsets({
    subcommand,
    cmdArgs,
    cwd,
  });

  const formatFn = result.success ? formatSuccess : formatError;

  return {
    decision: "block",
    reason: formatFn({ message: result.output }),
  };
};

/**
 * Unified nori-skillsets intercepted slash command
 * Matches /nori-skillsets <subcmd> and /sks <subcmd>
 */
export const noriSkillsets: InterceptedSlashCommand = {
  matchers: ["^\\/nori-skillsets(?:\\s+.*)?$", "^\\/sks(?:\\s+.*)?$"],
  run,
};
