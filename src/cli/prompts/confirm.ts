/**
 * Prompts confirm wrapper
 *
 * Provides a wrapper around @clack/prompts confirm function
 * with consistent cancel handling.
 */

import { confirm, isCancel } from "@clack/prompts";

import { handleCancel } from "./utils.js";

/**
 * Prompt user for confirmation
 *
 * @param args - Confirmation arguments
 * @param args.message - The message to display
 * @param args.initialValue - Optional initial value (default: true)
 *
 * @returns True if user confirms, false if user declines
 */
export const confirmAction = async (args: {
  message: string;
  initialValue?: boolean | null;
}): Promise<boolean> => {
  const { message, initialValue } = args;

  const options: { message: string; initialValue?: boolean } = { message };

  if (initialValue != null) {
    options.initialValue = initialValue;
  }

  const result = await confirm(options);

  if (isCancel(result)) {
    handleCancel();
  }

  return result as boolean;
};
