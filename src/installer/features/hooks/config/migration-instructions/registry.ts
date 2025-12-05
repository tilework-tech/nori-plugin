/**
 * Registry of all migration instructions
 */

import type { MigrationInstruction } from "./types.js";

import { oldProfilesLocation } from "./old-profiles-location.js";

/**
 * All registered migration instructions
 * Add new migrations here as they are created
 */
export const migrationInstructions: Record<string, MigrationInstruction> = {
  oldProfilesLocation,
};
