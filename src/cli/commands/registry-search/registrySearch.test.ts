/**
 * Tests for registry-search CLI command
 * Searches both profiles and skills in org registry (from config.auth)
 */

import * as fs from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the registrar API
vi.mock("@/api/registrar.js", () => ({
  registrarApi: {
    searchPackages: vi.fn(),
    searchPackagesOnRegistry: vi.fn(),
    searchSkills: vi.fn(),
  },
}));

// Mock the registry auth module
vi.mock("@/api/registryAuth.js", () => ({
  getRegistryAuthToken: vi.fn(),
}));

// Mock the config module - include getInstalledAgents with real implementation
vi.mock("@/cli/config.js", async () => {
  return {
    loadConfig: vi.fn(),
    getInstalledAgents: (args: {
      config: { agents?: Record<string, unknown> | null };
    }) => {
      const agents = Object.keys(args.config.agents ?? {});
      return agents.length > 0 ? agents : ["claude-code"];
    },
  };
});

// Mock console methods to capture output
const mockConsoleLog = vi
  .spyOn(console, "log")
  .mockImplementation(() => undefined);
const mockConsoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => undefined);

import { registrarApi } from "@/api/registrar.js";
import { getRegistryAuthToken } from "@/api/registryAuth.js";
import { loadConfig } from "@/cli/config.js";
import { stripAnsi } from "@/cli/features/test-utils/index.js";

import { registrySearchMain } from "./registrySearch.js";

/**
 * Get all console output as a single string with ANSI codes stripped
 * @returns Combined log and error output with ANSI codes stripped
 */
const getAllOutput = (): string => {
  const logOutput = mockConsoleLog.mock.calls
    .map((call) => call.join(" "))
    .join("\n");
  const errorOutput = mockConsoleError.mock.calls
    .map((call) => call.join(" "))
    .join("\n");
  return stripAnsi(logOutput + "\n" + errorOutput);
};

describe("registry-search", () => {
  let testDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDir = await fs.mkdtemp(path.join(tmpdir(), "nori-cli-search-test-"));
    await fs.writeFile(
      path.join(testDir, ".nori-config.json"),
      JSON.stringify({
        agents: { "claude-code": { profile: { baseProfile: "senior-swe" } } },
      }),
    );
    vi.mocked(loadConfig).mockResolvedValue({
      installDir: testDir,
      agents: {
        "claude-code": { profile: { baseProfile: "senior-swe" } },
      },
      auth: {
        username: "user@example.com",
        organizationUrl: "https://myorg.tilework.tech",
        refreshToken: "mock-refresh-token",
      },
    });
    vi.mocked(getRegistryAuthToken).mockResolvedValue("mock-auth-token");
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe("unified search - profiles and skills", () => {
    it("should search both profiles and skills APIs", async () => {
      const mockPackages = [
        {
          id: "1",
          name: "typescript-profile",
          description: "A TypeScript profile",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      const mockSkills = [
        {
          id: "2",
          name: "typescript-skill",
          description: "A TypeScript skill",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      vi.mocked(registrarApi.searchPackagesOnRegistry).mockResolvedValue(
        mockPackages,
      );
      vi.mocked(registrarApi.searchSkills).mockResolvedValue(mockSkills);

      await registrySearchMain({ query: "typescript", installDir: testDir });

      // Verify both APIs were called
      expect(registrarApi.searchPackagesOnRegistry).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "typescript",
          registryUrl: "https://myorg.nori-registry.ai",
          authToken: "mock-auth-token",
        }),
      );
      expect(registrarApi.searchSkills).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "typescript",
          registryUrl: "https://myorg.nori-registry.ai",
          authToken: "mock-auth-token",
        }),
      );
    });

    it("should display results with Profiles and Skills section headers", async () => {
      const mockPackages = [
        {
          id: "1",
          name: "my-profile",
          description: "A profile",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      const mockSkills = [
        {
          id: "2",
          name: "my-skill",
          description: "A skill",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      vi.mocked(registrarApi.searchPackagesOnRegistry).mockResolvedValue(
        mockPackages,
      );
      vi.mocked(registrarApi.searchSkills).mockResolvedValue(mockSkills);

      await registrySearchMain({ query: "my", installDir: testDir });

      const output = getAllOutput();
      expect(output).toContain("Profiles:");
      expect(output).toContain("my-profile");
      expect(output).toContain("Skills:");
      expect(output).toContain("my-skill");
    });

    it("should show only Profiles section when no skills found", async () => {
      const mockPackages = [
        {
          id: "1",
          name: "only-profile",
          description: "A profile",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      vi.mocked(registrarApi.searchPackagesOnRegistry).mockResolvedValue(
        mockPackages,
      );
      vi.mocked(registrarApi.searchSkills).mockResolvedValue([]);

      await registrySearchMain({ query: "only", installDir: testDir });

      const output = getAllOutput();
      expect(output).toContain("Profiles:");
      expect(output).toContain("only-profile");
      expect(output).not.toContain("Skills:");
    });

    it("should show only Skills section when no profiles found", async () => {
      const mockSkills = [
        {
          id: "1",
          name: "only-skill",
          description: "A skill",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      vi.mocked(registrarApi.searchPackagesOnRegistry).mockResolvedValue([]);
      vi.mocked(registrarApi.searchSkills).mockResolvedValue(mockSkills);

      await registrySearchMain({ query: "only", installDir: testDir });

      const output = getAllOutput();
      expect(output).not.toContain("Profiles:");
      expect(output).toContain("Skills:");
      expect(output).toContain("only-skill");
    });

    it("should display no results message when both APIs return empty", async () => {
      vi.mocked(registrarApi.searchPackagesOnRegistry).mockResolvedValue([]);
      vi.mocked(registrarApi.searchSkills).mockResolvedValue([]);

      await registrySearchMain({ query: "nonexistent", installDir: testDir });

      const output = getAllOutput();
      expect(output.toLowerCase()).toContain("no");
      expect(output).toContain("nonexistent");
    });

    it("should show profile results and skills error when skills API fails", async () => {
      const mockPackages = [
        {
          id: "1",
          name: "good-profile",
          description: "A profile",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      vi.mocked(registrarApi.searchPackagesOnRegistry).mockResolvedValue(
        mockPackages,
      );
      vi.mocked(registrarApi.searchSkills).mockRejectedValue(
        new Error("Skills API error"),
      );

      await registrySearchMain({ query: "test", installDir: testDir });

      const output = getAllOutput();
      expect(output).toContain("Profiles:");
      expect(output).toContain("good-profile");
      expect(output.toLowerCase()).toContain("error");
      expect(output).toContain("Skills API error");
    });

    it("should show skills results and profiles error when profiles API fails", async () => {
      const mockSkills = [
        {
          id: "1",
          name: "good-skill",
          description: "A skill",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      vi.mocked(registrarApi.searchPackagesOnRegistry).mockRejectedValue(
        new Error("Profiles API error"),
      );
      vi.mocked(registrarApi.searchSkills).mockResolvedValue(mockSkills);

      await registrySearchMain({ query: "test", installDir: testDir });

      const output = getAllOutput();
      expect(output).toContain("Skills:");
      expect(output).toContain("good-skill");
      expect(output.toLowerCase()).toContain("error");
      expect(output).toContain("Profiles API error");
    });

    it("should show both download hints when both types have results", async () => {
      const mockPackages = [
        {
          id: "1",
          name: "test-profile",
          description: "A profile",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      const mockSkills = [
        {
          id: "2",
          name: "test-skill",
          description: "A skill",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      vi.mocked(registrarApi.searchPackagesOnRegistry).mockResolvedValue(
        mockPackages,
      );
      vi.mocked(registrarApi.searchSkills).mockResolvedValue(mockSkills);

      await registrySearchMain({ query: "test", installDir: testDir });

      const output = getAllOutput();
      expect(output).toContain("registry-download");
      expect(output).toContain("skill-download");
    });

    it("should only show profile download hint when only profiles found", async () => {
      const mockPackages = [
        {
          id: "1",
          name: "test-profile",
          description: "A profile",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      vi.mocked(registrarApi.searchPackagesOnRegistry).mockResolvedValue(
        mockPackages,
      );
      vi.mocked(registrarApi.searchSkills).mockResolvedValue([]);

      await registrySearchMain({ query: "test", installDir: testDir });

      const output = getAllOutput();
      expect(output).toContain("registry-download");
      expect(output).not.toContain("skill-download");
    });

    it("should only show skill download hint when only skills found", async () => {
      const mockSkills = [
        {
          id: "1",
          name: "test-skill",
          description: "A skill",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      vi.mocked(registrarApi.searchPackagesOnRegistry).mockResolvedValue([]);
      vi.mocked(registrarApi.searchSkills).mockResolvedValue(mockSkills);

      await registrySearchMain({ query: "test", installDir: testDir });

      const output = getAllOutput();
      expect(output).not.toContain("registry-download");
      expect(output).toContain("skill-download");
    });
  });

  describe("config and auth validation", () => {
    it("should not search anything when no auth is configured", async () => {
      vi.mocked(loadConfig).mockResolvedValue({
        installDir: testDir,
        agents: { "claude-code": { profile: { baseProfile: "senior-swe" } } },
      });

      await registrySearchMain({ query: "test", installDir: testDir });

      expect(registrarApi.searchPackagesOnRegistry).not.toHaveBeenCalled();
      expect(registrarApi.searchSkills).not.toHaveBeenCalled();
    });
  });

  describe("cursor-agent validation", () => {
    it("should fail when only cursor-agent is installed", async () => {
      vi.mocked(loadConfig).mockResolvedValue({
        installDir: testDir,
        agents: { "cursor-agent": { profile: { baseProfile: "amol" } } },
        auth: {
          username: "user@example.com",
          organizationUrl: "https://myorg.tilework.tech",
          refreshToken: "token",
        },
      });

      await registrySearchMain({ query: "test", installDir: testDir });

      expect(registrarApi.searchPackagesOnRegistry).not.toHaveBeenCalled();
      expect(registrarApi.searchSkills).not.toHaveBeenCalled();
      const output = getAllOutput();
      expect(output.toLowerCase()).toContain("not supported");
    });
  });
});
