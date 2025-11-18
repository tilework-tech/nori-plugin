/**
 * User prompt utilities for installer
 * Shared functions for prompting user for input
 */

import * as readline from "readline";

/**
 * Prompt user for input
 * @param args - Configuration arguments
 * @param args.prompt - Prompt text to display
 * @param args.hidden - Whether to hide input (for passwords)
 *
 * @returns User's input as a string
 */
export const promptUser = async (args: {
  prompt: string;
  hidden?: boolean | null;
}): Promise<string> => {
  const { prompt, hidden } = args;

  if (hidden) {
    // Hidden password input - use raw mode without readline
    const stdin = process.stdin;

    // Write prompt FIRST, before entering raw mode
    process.stdout.write(prompt);

    // Resume stdin to ensure it's actively reading
    stdin.resume();

    // THEN enter raw mode
    (stdin as any).setRawMode?.(true);
    stdin.setEncoding("utf8");

    let password = "";

    return new Promise((resolve) => {
      const onData = (char: string) => {
        if (char === "\r" || char === "\n") {
          // Enter - clean up and resolve
          stdin.removeListener("data", onData);
          (stdin as any).setRawMode?.(false);
          stdin.pause();
          process.stdout.write("\n");
          resolve(password);
        } else if (char === "\u0003") {
          // Ctrl+C - clean up and exit
          stdin.removeListener("data", onData);
          (stdin as any).setRawMode?.(false);
          process.exit(1);
        } else if (char === "\u007f") {
          // Backspace - remove last character (no visual feedback)
          password = password.slice(0, -1);
        } else {
          // Regular character - add to password (no visual feedback)
          password += char;
        }
      };

      stdin.on("data", onData);
    });
  } else {
    // Normal input - use readline
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
};
