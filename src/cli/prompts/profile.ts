/**
 * Prompts profile selection wrapper
 *
 * Provides a wrapper around @clack/prompts select function
 * for selecting profiles from a list.
 */

import { select, isCancel } from "@clack/prompts";

import { handleCancel } from "./utils.js";

/**
 * Profile option for selection
 */
export type ProfileOption = {
  name: string;
  description: string;
};

/**
 * Result of profile selection
 */
export type ProfileSelection = {
  baseProfile: string;
};

/**
 * Prompt user to select a profile from a list
 *
 * @param args - Selection arguments
 * @param args.profiles - Available profiles to choose from
 * @param args.message - Optional custom message (default: "Select a profile")
 *
 * @throws Error if profiles array is empty
 *
 * @returns The selected profile as { baseProfile: string }
 */
export const selectProfile = async (args: {
  profiles: Array<ProfileOption>;
  message?: string | null;
}): Promise<ProfileSelection> => {
  const { profiles, message } = args;

  if (profiles.length === 0) {
    throw new Error("No profiles available for selection");
  }

  const options = profiles.map((p) => ({
    value: p.name,
    label: p.name,
    hint: p.description,
  }));

  const result = await select({
    message: message ?? "Select a profile",
    options,
  });

  if (isCancel(result)) {
    handleCancel();
  }

  return { baseProfile: result as string };
};
