/**
 * Tests for registry-install CLI command
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("os", async () => {
  const actual: any = await vi.importActual("os");
  return {
    ...actual,
    homedir: vi.fn(() => "/mock-home"),
  };
});

vi.mock("@/api/registrar.js", () => ({
  REGISTRAR_URL: "https://registrar.tilework.tech",
}));

vi.mock("@/cli/commands/registry-download/registryDownload.js", () => ({
  registryDownloadMain: vi.fn(),
}));

vi.mock("@/cli/commands/install/install.js", () => ({
  main: vi.fn(),
}));

vi.mock("@/cli/commands/install/installState.js", () => ({
  hasExistingInstallation: vi.fn(() => false),
}));

const mockSwitchProfile = vi.fn();

vi.mock("@/cli/features/agentRegistry.js", () => ({
  AgentRegistry: {
    getInstance: () => ({
      get: () => ({
        switchProfile: mockSwitchProfile,
      }),
    }),
  },
}));

import { REGISTRAR_URL } from "@/api/registrar.js";
import { main as installMain } from "@/cli/commands/install/install.js";
import { hasExistingInstallation } from "@/cli/commands/install/installState.js";
import { registryDownloadMain } from "@/cli/commands/registry-download/registryDownload.js";

import { registryInstallMain } from "./registryInstall.js";

describe("registry-install", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should run initial install, download profile, switch profile, and regenerate files when no existing installation", async () => {
    await registryInstallMain({
      packageSpec: "senior-swe",
      cwd: "/repo",
    });

    // Step 1: Initial install (no existing installation)
    expect(installMain).toHaveBeenNthCalledWith(1, {
      nonInteractive: true,
      installDir: "/repo",
      profile: "senior-swe",
      agent: "claude-code",
      silent: null,
    });

    // Step 2: Download profile from registry
    expect(registryDownloadMain).toHaveBeenCalledWith({
      packageSpec: "senior-swe",
      installDir: "/repo",
      registryUrl: REGISTRAR_URL,
      listVersions: null,
    });

    // Step 3: Switch to downloaded profile
    expect(mockSwitchProfile).toHaveBeenCalledWith({
      installDir: "/repo",
      profileName: "senior-swe",
    });

    // Step 4: Regenerate files with new profile
    expect(installMain).toHaveBeenNthCalledWith(2, {
      nonInteractive: true,
      skipUninstall: true,
      installDir: "/repo",
      agent: "claude-code",
      silent: true,
    });

    expect(installMain).toHaveBeenCalledTimes(2);
  });

  it("should skip initial install but still download and switch profile when existing installation detected", async () => {
    vi.mocked(hasExistingInstallation).mockReturnValueOnce(true);

    await registryInstallMain({
      packageSpec: "senior-swe",
      cwd: "/repo",
    });

    expect(hasExistingInstallation).toHaveBeenCalledWith({
      installDir: "/repo",
    });

    // Step 2: Download profile from registry (still happens)
    expect(registryDownloadMain).toHaveBeenCalledWith({
      packageSpec: "senior-swe",
      installDir: "/repo",
      registryUrl: REGISTRAR_URL,
      listVersions: null,
    });

    // Step 3: Switch to downloaded profile (still happens)
    expect(mockSwitchProfile).toHaveBeenCalledWith({
      installDir: "/repo",
      profileName: "senior-swe",
    });

    // Step 4: Regenerate files (still happens, but only once since initial install was skipped)
    expect(installMain).toHaveBeenCalledTimes(1);
    expect(installMain).toHaveBeenCalledWith({
      nonInteractive: true,
      skipUninstall: true,
      installDir: "/repo",
      agent: "claude-code",
      silent: true,
    });
  });

  it("should install to the user home directory when --user is set", async () => {
    await registryInstallMain({
      packageSpec: "product-manager",
      useHomeDir: true,
    });

    expect(registryDownloadMain).toHaveBeenCalledWith({
      packageSpec: "product-manager",
      installDir: "/mock-home",
      registryUrl: REGISTRAR_URL,
      listVersions: null,
    });

    expect(mockSwitchProfile).toHaveBeenCalledWith({
      installDir: "/mock-home",
      profileName: "product-manager",
    });
  });

  it("should parse versioned package specs and use the profile name for install", async () => {
    await registryInstallMain({
      packageSpec: "documenter@2.1.0",
      cwd: "/repo",
    });

    expect(registryDownloadMain).toHaveBeenCalledWith({
      packageSpec: "documenter@2.1.0",
      installDir: "/repo",
      registryUrl: REGISTRAR_URL,
      listVersions: null,
    });

    expect(mockSwitchProfile).toHaveBeenCalledWith({
      installDir: "/repo",
      profileName: "documenter",
    });
  });
});
