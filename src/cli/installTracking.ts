import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { createHash, randomUUID } from "crypto";

import semver from "semver";

const DEFAULT_ANALYTICS_URL =
  "https://noriskillsets.dev/api/analytics/track";
const INSTALL_STATE_SCHEMA_VERSION = 1;
const INSTALL_STATE_FILE = ".nori-install.json";
const RESURRECTION_THRESHOLD_DAYS = 30;

type InstallState = {
  schema_version: number;
  client_id: string;
  opt_out: boolean;
  first_installed_at: string;
  last_updated_at: string;
  last_launched_at: string;
  installed_version: string;
  install_source: string;
};

const getInstallStatePath = (): string => {
  return path.join(
    os.homedir(),
    ".nori",
    "profiles",
    INSTALL_STATE_FILE,
  );
};

const isOptedOut = (state: InstallState | null): boolean => {
  if (process.env.NORI_NO_ANALYTICS === "1") {
    return true;
  }

  return state?.opt_out === true;
};

const getInstallSource = (): string => {
  const userAgent = process.env.npm_config_user_agent ?? "";

  if (userAgent.includes("bun")) {
    return "bun";
  }

  if (userAgent.includes("pnpm")) {
    return "pnpm";
  }

  if (userAgent.includes("yarn")) {
    return "yarn";
  }

  if (userAgent.includes("npm")) {
    return "npm";
  }

  return "unknown";
};

const formatHashAsUuid = (hash: string): string => {
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
};

const getDeterministicClientId = (): string => {
  let username = "unknown";
  try {
    username = os.userInfo().username;
  } catch {
    username = process.env.USER ?? process.env.USERNAME ?? "unknown";
  }

  const hostname = os.hostname();
  const hash = createHash("sha256")
    .update(`nori_salt:${hostname}:${username}`)
    .digest("hex");
  return formatHashAsUuid(hash);
};

const readInstallState = async (): Promise<InstallState | null> => {
  const filePath = getInstallStatePath();

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as InstallState;
  } catch {
    return null;
  }
};

const writeInstallState = async (state: InstallState): Promise<void> => {
  const filePath = getInstallStatePath();
  const dirPath = path.dirname(filePath);

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`);
};

const isCiEnvironment = (): boolean => {
  const env = process.env;
  return Boolean(
    env.CI ||
      env.GITHUB_ACTIONS ||
      env.GITLAB_CI ||
      env.BUILDKITE ||
      env.CIRCLECI ||
      env.TRAVIS ||
      env.BITBUCKET_BUILD_NUMBER,
  );
};

const fireAndForgetAnalyticsEvent = (payload: {
  event: string;
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
}): void => {
  const analyticsUrl =
    process.env.NORI_ANALYTICS_URL ?? DEFAULT_ANALYTICS_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);

  void fetch(analyticsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch(() => {
      // Silent failure
    })
    .finally(() => {
      clearTimeout(timeout);
    });
};

const shouldTriggerResurrection = (state: InstallState): boolean => {
  if (!state.last_launched_at) {
    return false;
  }

  const lastLaunch = new Date(state.last_launched_at).getTime();
  if (Number.isNaN(lastLaunch)) {
    return false;
  }

  const thresholdMs =
    RESURRECTION_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - lastLaunch > thresholdMs;
};

export const trackInstallLifecycle = async (args: {
  currentVersion: string;
}): Promise<void> => {
  const { currentVersion } = args;

  try {
    const now = new Date().toISOString();
    const sessionId = randomUUID();
    const stateFromDisk = await readInstallState();

    let state = stateFromDisk;
    let eventToSend: "app_install" | "app_update" | null = null;

    if (state == null) {
      const clientId = getDeterministicClientId();
      state = {
        schema_version: INSTALL_STATE_SCHEMA_VERSION,
        client_id: clientId,
        opt_out: false,
        first_installed_at: now,
        last_updated_at: now,
        last_launched_at: now,
        installed_version: currentVersion,
        install_source: getInstallSource(),
      };
      eventToSend = "app_install";
    } else {
      if (!state.client_id) {
        state.client_id = getDeterministicClientId();
      }

      if (!state.install_source) {
        state.install_source = getInstallSource();
      }

      if (
        semver.valid(currentVersion) != null &&
        semver.valid(state.installed_version) != null &&
        semver.gt(currentVersion, state.installed_version)
      ) {
        state.installed_version = currentVersion;
        state.last_updated_at = now;
        eventToSend = "app_update";
      }
    }

    const isResurrected = stateFromDisk
      ? shouldTriggerResurrection(stateFromDisk)
      : false;

    state.last_launched_at = now;
    state.schema_version = INSTALL_STATE_SCHEMA_VERSION;

    if (!state.first_installed_at) {
      state.first_installed_at = now;
    }

    if (!state.last_updated_at) {
      state.last_updated_at = now;
    }

    await writeInstallState(state);

    if (isOptedOut(state)) {
      return;
    }

    const basePayload = {
      client_id: state.client_id,
      session_id: sessionId,
      timestamp: now,
      properties: {
        version: currentVersion,
        os: process.platform,
        arch: process.arch,
        node_version: process.versions.node,
        is_ci: isCiEnvironment(),
      },
    };

    if (isResurrected) {
      fireAndForgetAnalyticsEvent({
        event: "user_resurrected",
        ...basePayload,
      });
    }

    if (eventToSend != null) {
      fireAndForgetAnalyticsEvent({
        event: eventToSend,
        ...basePayload,
      });
    }

    fireAndForgetAnalyticsEvent({
      event: "session_start",
      ...basePayload,
    });
  } catch {
    // Silent failure - analytics should never block CLI
  }
};
