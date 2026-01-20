import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trackInstallLifecycle } from "./installTracking.js";

const INSTALL_STATE_FILE = ".nori-install.json";

const getTestInstallStatePath = (): string => {
  return path.join(os.homedir(), ".nori", "profiles", INSTALL_STATE_FILE);
};

describe("installTracking", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let fetchMock: ReturnType<typeof vi.fn>;
  let installStatePath: string;
  let tempProfilesDir: string;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    installStatePath = getTestInstallStatePath();
    tempProfilesDir = path.dirname(installStatePath);

    // Ensure the profiles directory exists
    await fs.mkdir(tempProfilesDir, { recursive: true });

    // Clear any existing install state
    try {
      await fs.unlink(installStatePath);
    } catch {
      // File doesn't exist, that's fine
    }

    // Mock fetch
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    // Clean up install state file
    try {
      await fs.unlink(installStatePath);
    } catch {
      // File doesn't exist, that's fine
    }
  });

  describe("resurrection threshold calculation", () => {
    it("should trigger resurrection after more than 30 days of inactivity", async () => {
      // Create state with last_launched_at 31 days ago (just over threshold)
      const thirtyOneDaysAgo = new Date(
        Date.now() - 31 * 24 * 60 * 60 * 1000,
      ).toISOString();

      await fs.writeFile(
        installStatePath,
        JSON.stringify({
          schema_version: 1,
          client_id: "test-client-id",
          opt_out: false,
          first_installed_at: thirtyOneDaysAgo,
          last_updated_at: thirtyOneDaysAgo,
          last_launched_at: thirtyOneDaysAgo,
          installed_version: "1.0.0",
          install_source: "npm",
        }),
      );

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      // Should have sent user_resurrected event
      const resurrectedCall = fetchMock.mock.calls.find((call) => {
        const body = JSON.parse(call[1].body);
        return body.event === "user_resurrected";
      });

      expect(resurrectedCall).toBeDefined();
    });

    it("should NOT trigger resurrection at 29 days 23 hours", async () => {
      // Create state with last_launched_at just under 30 days ago
      const justUnder30Days = new Date(
        Date.now() - (30 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000),
      ).toISOString();

      await fs.writeFile(
        installStatePath,
        JSON.stringify({
          schema_version: 1,
          client_id: "test-client-id",
          opt_out: false,
          first_installed_at: justUnder30Days,
          last_updated_at: justUnder30Days,
          last_launched_at: justUnder30Days,
          installed_version: "1.0.0",
          install_source: "npm",
        }),
      );

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      // Should NOT have sent user_resurrected event
      const resurrectedCall = fetchMock.mock.calls.find((call) => {
        const body = JSON.parse(call[1].body);
        return body.event === "user_resurrected";
      });

      expect(resurrectedCall).toBeUndefined();
    });

    it("should use days (not seconds) for resurrection threshold", async () => {
      // 30 seconds ago - if threshold was in seconds, this would trigger resurrection
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();

      await fs.writeFile(
        installStatePath,
        JSON.stringify({
          schema_version: 1,
          client_id: "test-client-id",
          opt_out: false,
          first_installed_at: thirtySecondsAgo,
          last_updated_at: thirtySecondsAgo,
          last_launched_at: thirtySecondsAgo,
          installed_version: "1.0.0",
          install_source: "npm",
        }),
      );

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      // Should NOT have sent user_resurrected event (30 seconds is not 30 days)
      const resurrectedCall = fetchMock.mock.calls.find((call) => {
        const body = JSON.parse(call[1].body);
        return body.event === "user_resurrected";
      });

      expect(resurrectedCall).toBeUndefined();
    });
  });

  describe("install_source update on change", () => {
    it("should update install_source when package manager changes", async () => {
      // Create state with npm as install_source
      const existingState = {
        schema_version: 1,
        client_id: "test-client-id",
        opt_out: false,
        first_installed_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        last_launched_at: new Date().toISOString(),
        installed_version: "1.0.0",
        install_source: "npm",
      };

      await fs.writeFile(installStatePath, JSON.stringify(existingState));

      // Simulate running from bun
      process.env.npm_config_user_agent = "bun/1.0.0";

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      // Read the updated state
      const updatedContent = await fs.readFile(installStatePath, "utf-8");
      const updatedState = JSON.parse(updatedContent);

      expect(updatedState.install_source).toBe("bun");
    });

    it("should NOT update install_source when package manager is the same", async () => {
      const originalDate = "2024-01-01T00:00:00.000Z";
      const existingState = {
        schema_version: 1,
        client_id: "test-client-id",
        opt_out: false,
        first_installed_at: originalDate,
        last_updated_at: originalDate,
        last_launched_at: originalDate,
        installed_version: "1.0.0",
        install_source: "npm",
      };

      await fs.writeFile(installStatePath, JSON.stringify(existingState));

      // Simulate running from npm (same as existing)
      process.env.npm_config_user_agent = "npm/10.0.0";

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      // Read the updated state
      const updatedContent = await fs.readFile(installStatePath, "utf-8");
      const updatedState = JSON.parse(updatedContent);

      // install_source should remain npm
      expect(updatedState.install_source).toBe("npm");
    });
  });

  describe("state field backfill on startup", () => {
    it("should populate client_id if missing from existing state", async () => {
      const existingState = {
        schema_version: 1,
        // Missing client_id
        opt_out: false,
        first_installed_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        last_launched_at: new Date().toISOString(),
        installed_version: "1.0.0",
        install_source: "npm",
      };

      await fs.writeFile(installStatePath, JSON.stringify(existingState));

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      const updatedContent = await fs.readFile(installStatePath, "utf-8");
      const updatedState = JSON.parse(updatedContent);

      expect(updatedState.client_id).toBeDefined();
      expect(updatedState.client_id).toMatch(/^[a-f0-9-]{36}$/i);
    });

    it("should populate install_source if missing from existing state", async () => {
      const existingState = {
        schema_version: 1,
        client_id: "test-client-id",
        opt_out: false,
        first_installed_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        last_launched_at: new Date().toISOString(),
        installed_version: "1.0.0",
        // Missing install_source
      };

      await fs.writeFile(installStatePath, JSON.stringify(existingState));
      process.env.npm_config_user_agent = "yarn/4.0.0";

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      const updatedContent = await fs.readFile(installStatePath, "utf-8");
      const updatedState = JSON.parse(updatedContent);

      expect(updatedState.install_source).toBe("yarn");
    });

    it("should populate first_installed_at if missing from existing state", async () => {
      const existingState = {
        schema_version: 1,
        client_id: "test-client-id",
        opt_out: false,
        // Missing first_installed_at
        last_updated_at: new Date().toISOString(),
        last_launched_at: new Date().toISOString(),
        installed_version: "1.0.0",
        install_source: "npm",
      };

      await fs.writeFile(installStatePath, JSON.stringify(existingState));

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      const updatedContent = await fs.readFile(installStatePath, "utf-8");
      const updatedState = JSON.parse(updatedContent);

      expect(updatedState.first_installed_at).toBeDefined();
      // Should be a valid ISO date
      expect(new Date(updatedState.first_installed_at).toISOString()).toBe(
        updatedState.first_installed_at,
      );
    });

    it("should populate last_updated_at if missing from existing state", async () => {
      const existingState = {
        schema_version: 1,
        client_id: "test-client-id",
        opt_out: false,
        first_installed_at: new Date().toISOString(),
        // Missing last_updated_at
        last_launched_at: new Date().toISOString(),
        installed_version: "1.0.0",
        install_source: "npm",
      };

      await fs.writeFile(installStatePath, JSON.stringify(existingState));

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      const updatedContent = await fs.readFile(installStatePath, "utf-8");
      const updatedState = JSON.parse(updatedContent);

      expect(updatedState.last_updated_at).toBeDefined();
      // Should be a valid ISO date
      expect(new Date(updatedState.last_updated_at).toISOString()).toBe(
        updatedState.last_updated_at,
      );
    });

    it("should update schema_version to current version", async () => {
      const existingState = {
        schema_version: 0, // Old schema version
        client_id: "test-client-id",
        opt_out: false,
        first_installed_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        last_launched_at: new Date().toISOString(),
        installed_version: "1.0.0",
        install_source: "npm",
      };

      await fs.writeFile(installStatePath, JSON.stringify(existingState));

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      const updatedContent = await fs.readFile(installStatePath, "utf-8");
      const updatedState = JSON.parse(updatedContent);

      expect(updatedState.schema_version).toBe(1);
    });
  });

  describe("trackInstallLifecycle integration", () => {
    it("should create new state file on first run", async () => {
      // Ensure no state file exists
      try {
        await fs.unlink(installStatePath);
      } catch {
        // File doesn't exist
      }

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      const exists = await fs
        .access(installStatePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(installStatePath, "utf-8");
      const state = JSON.parse(content);

      expect(state.schema_version).toBe(1);
      expect(state.client_id).toBeDefined();
      expect(state.installed_version).toBe("1.0.0");
    });

    it("should send app_install event on first run", async () => {
      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      const installCall = fetchMock.mock.calls.find((call) => {
        const body = JSON.parse(call[1].body);
        return body.event === "app_install";
      });

      expect(installCall).toBeDefined();
    });

    it("should send app_update event on version upgrade", async () => {
      const existingState = {
        schema_version: 1,
        client_id: "test-client-id",
        opt_out: false,
        first_installed_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        last_launched_at: new Date().toISOString(),
        installed_version: "1.0.0",
        install_source: "npm",
      };

      await fs.writeFile(installStatePath, JSON.stringify(existingState));

      await trackInstallLifecycle({ currentVersion: "2.0.0" });

      const updateCall = fetchMock.mock.calls.find((call) => {
        const body = JSON.parse(call[1].body);
        return body.event === "app_update";
      });

      expect(updateCall).toBeDefined();
    });

    it("should send session_start event on every run", async () => {
      const existingState = {
        schema_version: 1,
        client_id: "test-client-id",
        opt_out: false,
        first_installed_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        last_launched_at: new Date().toISOString(),
        installed_version: "1.0.0",
        install_source: "npm",
      };

      await fs.writeFile(installStatePath, JSON.stringify(existingState));

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      const sessionCall = fetchMock.mock.calls.find((call) => {
        const body = JSON.parse(call[1].body);
        return body.event === "session_start";
      });

      expect(sessionCall).toBeDefined();
    });

    it("should respect opt_out flag", async () => {
      const existingState = {
        schema_version: 1,
        client_id: "test-client-id",
        opt_out: true, // Opted out
        first_installed_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        last_launched_at: new Date().toISOString(),
        installed_version: "1.0.0",
        install_source: "npm",
      };

      await fs.writeFile(installStatePath, JSON.stringify(existingState));

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      // No analytics events should be sent
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should respect NORI_NO_ANALYTICS env var", async () => {
      process.env.NORI_NO_ANALYTICS = "1";

      await trackInstallLifecycle({ currentVersion: "1.0.0" });

      // No analytics events should be sent
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should NOT downgrade installed_version on older version run", async () => {
      const existingState = {
        schema_version: 1,
        client_id: "test-client-id",
        opt_out: false,
        first_installed_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        last_launched_at: new Date().toISOString(),
        installed_version: "2.0.0", // Higher version
        install_source: "npm",
      };

      await fs.writeFile(installStatePath, JSON.stringify(existingState));

      await trackInstallLifecycle({ currentVersion: "1.0.0" }); // Lower version

      const updatedContent = await fs.readFile(installStatePath, "utf-8");
      const updatedState = JSON.parse(updatedContent);

      // Version should remain at 2.0.0, not downgrade to 1.0.0
      expect(updatedState.installed_version).toBe("2.0.0");
    });
  });
});
