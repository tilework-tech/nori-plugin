/**
 * Registry of Cursor intercepted slash commands
 *
 * Each command is checked in order, and the first matching command is executed.
 * All matchers should be unique across commands.
 *
 * Note: This is a separate registry from Claude Code's intercepted slash commands.
 * Cursor does NOT include toggle commands (autoupdate, session-transcripts) as those
 * are Claude Code specific features.
 */

import type { InterceptedSlashCommand } from "./types.js";

import { cursorNoriInstallLocation } from "./nori-install-location.js";
import { cursorNoriRegistryDownload } from "./nori-registry-download.js";
import { cursorNoriRegistrySearch } from "./nori-registry-search.js";
import { cursorNoriRegistryUpload } from "./nori-registry-upload.js";
import { cursorNoriSwitchProfile } from "./nori-switch-profile.js";

/**
 * Registry of all Cursor intercepted slash commands
 * Note: Does NOT include nori-toggle-autoupdate or nori-toggle-session-transcripts
 * as those are Claude Code specific features.
 */
export const cursorInterceptedSlashCommands: Array<InterceptedSlashCommand> = [
  cursorNoriInstallLocation,
  cursorNoriRegistryUpload,
  cursorNoriRegistryDownload,
  cursorNoriRegistrySearch,
  cursorNoriSwitchProfile,
];
