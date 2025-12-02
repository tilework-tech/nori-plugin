/**
 * Formatting utilities for intercepted slash command output
 */

// ANSI color codes
const GREEN = "\x1b[0;32m";
const RED = "\x1b[0;31m";
const NC = "\x1b[0m"; // No Color / Reset

/**
 * Format a success message with green color
 * Wraps the entire message including newlines to prevent color bleeding on text wrap
 * @param args - The function arguments
 * @param args.message - The message to format
 *
 * @returns The message wrapped in green ANSI codes
 */
export const formatSuccess = (args: { message: string }): string => {
  const { message } = args;
  return `${GREEN}${message}${NC}`;
};

/**
 * Format an error message with red color
 * Wraps the entire message including newlines to prevent color bleeding on text wrap
 * @param args - The function arguments
 * @param args.message - The message to format
 *
 * @returns The message wrapped in red ANSI codes
 */
export const formatError = (args: { message: string }): string => {
  const { message } = args;
  return `${RED}${message}${NC}`;
};
