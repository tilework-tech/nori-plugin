/**
 * Install and session tracking for the Nori CLI
 *
 * Tracks installation lifecycle events (install, update, session, resurrection)
 * and manages persistent state in ~/.nori/profiles/.nori-install.json
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { hostname } from "os";
import { homedir, userInfo } from "os";
import { join } from "path";

import semver from "semver";

/**
 * State file schema for install tracking
 */
export type InstallState = {
  schema_version: number;
  client_id: string;
  opt_out: boolean;
  first_installed_at: string;
  last_updated_at: string;
  last_launched_at: string;
  installed_version: string;
  install_source: string;
};

/**
 * Event types that can be tracked
 */
export type TrackingEvent =
  | "app_install"
  | "app_update"
  | "session_start"
  | "user_resurrected";

/**
 * Event data to be sent to analytics
 */
export type TrackingEventData = {
  event: TrackingEvent;
  client_id: string;
  session_id: string;
  timestamp: string;
  properties: {
    version: string;
    os: string;
    arch: string;
    node_version: string;
    is_ci: boolean;
  };
};

const STATE_FILE_DIR = join(homedir(), ".nori", "profiles");
const STATE_FILE_PATH = join(STATE_FILE_DIR, ".nori-install.json");
const SCHEMA_VERSION = 2;
const RESURRECTION_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Generate a deterministic client ID based on hostname and username
 * Uses SHA256 hash formatted as a UUID
 *
 * @returns UUID-formatted client ID
 */
const generateClientId = (): string => {
  const hostName = hostname();
  const userName = userInfo().username;
  const input = `nori_salt:${hostName}:${userName}`;

  const hash = createHash("sha256").update(input).digest("hex");

  // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
};

/**
 * Detect install source based on environment
 *
 * @returns Install source identifier
 */
const detectInstallSource = (): string => {
  // Check for common package managers in PATH or environment
  const npmConfigUserAgent = process.env.npm_config_user_agent;

  if (npmConfigUserAgent != null) {
    if (npmConfigUserAgent.includes("bun")) {
      return "bun";
    }
    if (npmConfigUserAgent.includes("pnpm")) {
      return "pnpm";
    }
    if (npmConfigUserAgent.includes("yarn")) {
      return "yarn";
    }
    if (npmConfigUserAgent.includes("npm")) {
      return "npm";
    }
  }

  // Default fallback
  return "unknown";
};

/**
 * Check if running in CI environment
 *
 * @returns true if in CI environment
 */
const isCI = (): boolean => {
  return (
    process.env.CI === "true" ||
    process.env.CONTINUOUS_INTEGRATION === "true" ||
    process.env.BUILD_NUMBER != null ||
    process.env.GITHUB_ACTIONS === "true" ||
    process.env.TRAVIS === "true" ||
    process.env.CIRCLECI === "true" ||
    process.env.JENKINS_URL != null ||
    process.env.GITLAB_CI === "true"
  );
};

/**
 * Load the install state from disk
 *
 * @returns Install state or null if file doesn't exist
 */
const loadState = (): InstallState | null => {
  if (!existsSync(STATE_FILE_PATH)) {
    return null;
  }

  try {
    const content = readFileSync(STATE_FILE_PATH, "utf-8");
    const state = JSON.parse(content) as InstallState;
    return state;
  } catch {
    // If we can't read the file, treat it as if it doesn't exist
    return null;
  }
};

/**
 * Save the install state to disk
 *
 * @param args - Arguments
 * @param args.state - State to save
 */
const saveState = (args: { state: InstallState }): void => {
  const { state } = args;

  // Ensure directory exists
  if (!existsSync(STATE_FILE_DIR)) {
    mkdirSync(STATE_FILE_DIR, { recursive: true });
  }

  writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
};

/**
 * Check if user has opted out of analytics
 *
 * @param args - Arguments
 * @param args.state - Current state (may be null)
 *
 * @returns true if user has opted out
 */
export const isOptedOut = (args: { state: InstallState | null }): boolean => {
  const { state } = args;

  // Check environment variable first (highest priority)
  if (process.env.NORI_NO_ANALYTICS === "1") {
    return true;
  }

  // Check opt_out flag in state file
  if (state?.opt_out === true) {
    return true;
  }

  return false;
};

/**
 * Determine which tracking events should be fired based on current state
 *
 * @param args - Arguments
 * @param args.currentVersion - Current running version
 * @param args.state - Current state from disk (may be null)
 *
 * @returns Array of events to fire
 */
export const determineEvents = (args: {
  currentVersion: string;
  state: InstallState | null;
}): TrackingEvent[] => {
  const { currentVersion, state } = args;
  const events: TrackingEvent[] = [];

  // If no state file exists, this is a new installation
  if (state == null) {
    events.push("app_install");
    events.push("session_start");
    return events;
  }

  // Check for resurrection (30+ days since last launch)
  const lastLaunchedAt = new Date(state.last_launched_at).getTime();
  const now = new Date().getTime();
  const daysSinceLastLaunch = now - lastLaunchedAt;

  if (daysSinceLastLaunch >= RESURRECTION_THRESHOLD_MS) {
    events.push("user_resurrected");
  }

  // Check for version update
  const installedVersion = state.installed_version;
  if (
    semver.valid(currentVersion) != null &&
    semver.valid(installedVersion) != null &&
    semver.gt(currentVersion, installedVersion)
  ) {
    events.push("app_update");
  }

  // Always fire session_start
  events.push("session_start");

  return events;
};

/**
 * Update the install state based on events that occurred
 *
 * @param args - Arguments
 * @param args.currentVersion - Current running version
 * @param args.state - Current state (may be null for new install)
 * @param args.events - Events that were fired
 *
 * @returns Updated state
 */
export const updateState = (args: {
  currentVersion: string;
  state: InstallState | null;
  events: TrackingEvent[];
}): InstallState => {
  const { currentVersion, state, events } = args;
  const now = new Date().toISOString();

  // New installation
  if (state == null) {
    return {
      schema_version: SCHEMA_VERSION,
      client_id: generateClientId(),
      opt_out: false,
      first_installed_at: now,
      last_updated_at: now,
      last_launched_at: now,
      installed_version: currentVersion,
      install_source: detectInstallSource(),
    };
  }

  // Update existing state
  const updatedState: InstallState = {
    ...state,
    last_launched_at: now,
  };

  // If version was updated, update the version and timestamp
  if (events.includes("app_update")) {
    updatedState.installed_version = currentVersion;
    updatedState.last_updated_at = now;
  }

  return updatedState;
};

/**
 * Create event data for analytics
 *
 * @param args - Arguments
 * @param args.event - Event type
 * @param args.clientId - Client ID
 * @param args.sessionId - Session ID
 * @param args.version - Current version
 *
 * @returns Event data ready to send to analytics
 */
export const createEventData = (args: {
  event: TrackingEvent;
  clientId: string;
  sessionId: string;
  version: string;
}): TrackingEventData => {
  const { event, clientId, sessionId, version } = args;

  return {
    event,
    client_id: clientId,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    properties: {
      version,
      os: process.platform,
      arch: process.arch,
      node_version: process.version,
      is_ci: isCI(),
    },
  };
};

/**
 * Main tracking function - call this on CLI startup
 *
 * @param args - Arguments
 * @param args.currentVersion - Current running version
 * @param args.sessionId - Ephemeral session ID for this execution
 * @param args.onEvent - Callback to send events to analytics
 *
 * @returns Promise that resolves when tracking is complete
 */
export const trackInstallAndSession = async (args: {
  currentVersion: string;
  sessionId: string;
  onEvent: (eventData: TrackingEventData) => Promise<void>;
}): Promise<void> => {
  const { currentVersion, sessionId, onEvent } = args;

  try {
    // Load current state
    const state = loadState();

    // Check if user has opted out
    if (isOptedOut({ state })) {
      // Still update the state file to maintain timestamps
      const updatedState = updateState({
        currentVersion,
        state,
        events: [],
      });
      saveState({ state: updatedState });
      return;
    }

    // Determine which events to fire
    const events = determineEvents({ currentVersion, state });

    // Update state based on events
    const updatedState = updateState({ currentVersion, state, events });

    // Save updated state to disk
    saveState({ state: updatedState });

    // Fire events (non-blocking)
    for (const event of events) {
      const eventData = createEventData({
        event,
        clientId: updatedState.client_id,
        sessionId,
        version: currentVersion,
      });

      // Fire and forget - don't await
      onEvent(eventData).catch(() => {
        // Silent failure - analytics should never block CLI
      });
    }
  } catch {
    // Silent failure - analytics should never block CLI
  }
};
