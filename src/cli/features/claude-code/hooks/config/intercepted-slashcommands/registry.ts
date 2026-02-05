/**
 * Registry of intercepted slash commands
 *
 * Each command is checked in order, and the first matching command is executed.
 * All matchers should be unique across commands.
 */

import type { InterceptedSlashCommand } from "./types.js";

import { noriInstallLocation } from "./nori-install-location.js";
import { noriPruneContext } from "./nori-prune-context.js";
import { noriRegistryDownload } from "./nori-registry-download.js";
import { noriRegistrySearch } from "./nori-registry-search.js";
import { noriRegistryUpdate } from "./nori-registry-update.js";
import { noriRegistryUpload } from "./nori-registry-upload.js";
import { noriSkillsets } from "./nori-skillsets.js";
import { noriSwitchProfile } from "./nori-switch-profile.js";
import { noriToggleAutoupdate } from "./nori-toggle-autoupdate.js";
import { noriToggleSessionTranscripts } from "./nori-toggle-session-transcripts.js";

/**
 * Registry of all intercepted slash commands
 *
 * Note: noriSkillsets is first as it handles the unified /nori-skillsets and /sks commands.
 * Other commands use /nori-* prefix patterns and are kept for backward compatibility.
 */
export const interceptedSlashCommands: Array<InterceptedSlashCommand> = [
  noriSkillsets,
  noriInstallLocation,
  noriPruneContext,
  noriRegistryUpload,
  noriRegistryDownload,
  noriRegistryUpdate,
  noriRegistrySearch,
  noriSwitchProfile,
  noriToggleAutoupdate,
  noriToggleSessionTranscripts,
];
