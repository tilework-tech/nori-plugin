/**
 * Tests for registry-install CLI command
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("os", async () => {
  const actual = await vi.importActual<typeof import("os")>("os");
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

import { REGISTRAR_URL } from "@/api/registrar.js";
import { registryDownloadMain } from "@/cli/commands/registry-download/registryDownload.js";
import { main as installMain } from "@/cli/commands/install/install.js";

import { registryInstallMain } from "./registryInstall.js";

describe("registry-install", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should download profile and run non-interactive install in current dir", async () => {
    await registryInstallMain({
      packageSpec: "senior-swe",
      cwd: "/repo",
    });

    expect(registryDownloadMain).toHaveBeenCalledWith({
      packageSpec: "senior-swe",
      installDir: "/repo",
      registryUrl: REGISTRAR_URL,
      listVersions: null,
    });

    expect(installMain).toHaveBeenCalledWith({
      nonInteractive: true,
      installDir: "/repo",
      profile: "senior-swe",
      agent: "claude-code",
      silent: null,
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

    expect(installMain).toHaveBeenCalledWith({
      nonInteractive: true,
      installDir: "/mock-home",
      profile: "product-manager",
      agent: "claude-code",
      silent: null,
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

    expect(installMain).toHaveBeenCalledWith({
      nonInteractive: true,
      installDir: "/repo",
      profile: "documenter",
      agent: "claude-code",
      silent: null,
    });
  });
});
