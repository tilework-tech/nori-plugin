/**
 * Tests for nori-registry-search intercepted slash command
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

import { registrarApi } from "@/api/registrar.js";
import { getRegistryAuthToken } from "@/api/registryAuth.js";
import { stripAnsi } from "@/cli/features/test-utils/index.js";

import type { HookInput } from "./types.js";

import { noriRegistrySearch } from "./nori-registry-search.js";

describe("nori-registry-search", () => {
  let testDir: string;
  let configPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDir = await fs.mkdtemp(
      path.join(tmpdir(), "nori-registry-search-test-"),
    );
    configPath = path.join(testDir, ".nori-config.json");
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  const createInput = (args: {
    prompt: string;
    cwd?: string | null;
  }): HookInput => {
    const { prompt, cwd } = args;
    return {
      prompt,
      cwd: cwd ?? testDir,
      session_id: "test-session",
      transcript_path: "",
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
    };
  };

  describe("matchers", () => {
    it("should have valid regex matchers", () => {
      expect(noriRegistrySearch.matchers).toBeInstanceOf(Array);
      expect(noriRegistrySearch.matchers.length).toBeGreaterThan(0);

      for (const matcher of noriRegistrySearch.matchers) {
        expect(() => new RegExp(matcher)).not.toThrow();
      }
    });

    it("should match /nori-registry-search query", () => {
      const hasMatch = noriRegistrySearch.matchers.some((m) => {
        const regex = new RegExp(m, "i");
        return regex.test("/nori-registry-search test");
      });
      expect(hasMatch).toBe(true);
    });

    it("should match bare /nori-registry-search command", () => {
      const hasMatch = noriRegistrySearch.matchers.some((m) => {
        const regex = new RegExp(m, "i");
        return regex.test("/nori-registry-search");
      });
      expect(hasMatch).toBe(true);
    });
  });

  describe("help message", () => {
    it("should show help when no query provided", async () => {
      await fs.writeFile(
        configPath,
        JSON.stringify({
          agents: { "claude-code": { profile: { baseProfile: "senior-swe" } } },
          auth: {
            username: "user@example.com",
            organizationUrl: "https://myorg.tilework.tech",
            refreshToken: "token",
          },
        }),
      );

      const result = await noriRegistrySearch.run({
        input: createInput({ prompt: "/nori-registry-search" }),
      });

      expect(result).not.toBeNull();
      expect(result!.decision).toBe("block");
      const plainReason = stripAnsi(result!.reason!);
      expect(plainReason).toContain("Usage:");
      expect(plainReason).toContain("/nori-registry-search");
    });
  });

  describe("unified search - profiles and skills", () => {
    it("should search both profiles and skills APIs", async () => {
      await fs.writeFile(
        configPath,
        JSON.stringify({
          agents: { "claude-code": { profile: { baseProfile: "senior-swe" } } },
          auth: {
            username: "user@example.com",
            organizationUrl: "https://myorg.tilework.tech",
            refreshToken: "mock-token",
          },
        }),
      );

      const mockPackages = [
        {
          id: "1",
          name: "test-profile",
          description: "A test profile",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      const mockSkills = [
        {
          id: "2",
          name: "test-skill",
          description: "A test skill",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ];
      vi.mocked(registrarApi.searchPackagesOnRegistry).mockResolvedValue(
        mockPackages,
      );
      vi.mocked(registrarApi.searchSkills).mockResolvedValue(mockSkills);
      vi.mocked(getRegistryAuthToken).mockResolvedValue("mock-auth-token");

      const result = await noriRegistrySearch.run({
        input: createInput({ prompt: "/nori-registry-search test" }),
      });

      // Verify both APIs were called
      expect(registrarApi.searchPackagesOnRegistry).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "test",
          registryUrl: "https://myorg.nori-registry.ai",
          authToken: "mock-auth-token",
        }),
      );
      expect(registrarApi.searchSkills).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "test",
          registryUrl: "https://myorg.nori-registry.ai",
          authToken: "mock-auth-token",
        }),
      );

      expect(result).not.toBeNull();
      expect(result!.decision).toBe("block");
    });

    it("should display results with Profiles and Skills section headers", async () => {
      await fs.writeFile(
        configPath,
        JSON.stringify({
          agents: { "claude-code": { profile: { baseProfile: "senior-swe" } } },
          auth: {
            username: "user@example.com",
            organizationUrl: "https://myorg.tilework.tech",
            refreshToken: "mock-token",
          },
        }),
      );

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
      vi.mocked(getRegistryAuthToken).mockResolvedValue("mock-auth-token");

      const result = await noriRegistrySearch.run({
        input: createInput({ prompt: "/nori-registry-search my" }),
      });

      expect(result).not.toBeNull();
      const plainReason = stripAnsi(result!.reason!);
      expect(plainReason).toContain("Profiles:");
      expect(plainReason).toContain("my-profile");
      expect(plainReason).toContain("Skills:");
      expect(plainReason).toContain("my-skill");
    });

    it("should show only Profiles section when no skills found", async () => {
      await fs.writeFile(
        configPath,
        JSON.stringify({
          agents: { "claude-code": { profile: { baseProfile: "senior-swe" } } },
          auth: {
            username: "user@example.com",
            organizationUrl: "https://myorg.tilework.tech",
            refreshToken: "mock-token",
          },
        }),
      );

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
      vi.mocked(getRegistryAuthToken).mockResolvedValue("mock-auth-token");

      const result = await noriRegistrySearch.run({
        input: createInput({ prompt: "/nori-registry-search only" }),
      });

      expect(result).not.toBeNull();
      const plainReason = stripAnsi(result!.reason!);
      expect(plainReason).toContain("Profiles:");
      expect(plainReason).toContain("only-profile");
      expect(plainReason).not.toContain("Skills:");
    });

    it("should show only Skills section when no profiles found", async () => {
      await fs.writeFile(
        configPath,
        JSON.stringify({
          agents: { "claude-code": { profile: { baseProfile: "senior-swe" } } },
          auth: {
            username: "user@example.com",
            organizationUrl: "https://myorg.tilework.tech",
            refreshToken: "mock-token",
          },
        }),
      );

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
      vi.mocked(getRegistryAuthToken).mockResolvedValue("mock-auth-token");

      const result = await noriRegistrySearch.run({
        input: createInput({ prompt: "/nori-registry-search only" }),
      });

      expect(result).not.toBeNull();
      const plainReason = stripAnsi(result!.reason!);
      expect(plainReason).not.toContain("Profiles:");
      expect(plainReason).toContain("Skills:");
      expect(plainReason).toContain("only-skill");
    });

    it("should display no results message when both APIs return empty", async () => {
      await fs.writeFile(
        configPath,
        JSON.stringify({
          agents: { "claude-code": { profile: { baseProfile: "senior-swe" } } },
          auth: {
            username: "user@example.com",
            organizationUrl: "https://myorg.tilework.tech",
            refreshToken: "token",
          },
        }),
      );

      vi.mocked(registrarApi.searchPackagesOnRegistry).mockResolvedValue([]);
      vi.mocked(registrarApi.searchSkills).mockResolvedValue([]);
      vi.mocked(getRegistryAuthToken).mockResolvedValue("mock-auth-token");

      const result = await noriRegistrySearch.run({
        input: createInput({ prompt: "/nori-registry-search nonexistent" }),
      });

      expect(result).not.toBeNull();
      const plainReason = stripAnsi(result!.reason!);
      expect(plainReason.toLowerCase()).toContain("no");
      expect(plainReason).toContain("nonexistent");
    });

    it("should show profile results and skills error when skills API fails", async () => {
      await fs.writeFile(
        configPath,
        JSON.stringify({
          agents: { "claude-code": { profile: { baseProfile: "senior-swe" } } },
          auth: {
            username: "user@example.com",
            organizationUrl: "https://myorg.tilework.tech",
            refreshToken: "mock-token",
          },
        }),
      );

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
      vi.mocked(getRegistryAuthToken).mockResolvedValue("mock-auth-token");

      const result = await noriRegistrySearch.run({
        input: createInput({ prompt: "/nori-registry-search test" }),
      });

      expect(result).not.toBeNull();
      const plainReason = stripAnsi(result!.reason!);
      expect(plainReason).toContain("Profiles:");
      expect(plainReason).toContain("good-profile");
      expect(plainReason.toLowerCase()).toContain("error");
      expect(plainReason).toContain("Skills API error");
    });

    it("should show both download hints when both types have results", async () => {
      await fs.writeFile(
        configPath,
        JSON.stringify({
          agents: { "claude-code": { profile: { baseProfile: "senior-swe" } } },
          auth: {
            username: "user@example.com",
            organizationUrl: "https://myorg.tilework.tech",
            refreshToken: "mock-token",
          },
        }),
      );

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
      vi.mocked(getRegistryAuthToken).mockResolvedValue("mock-auth-token");

      const result = await noriRegistrySearch.run({
        input: createInput({ prompt: "/nori-registry-search test" }),
      });

      expect(result).not.toBeNull();
      const plainReason = stripAnsi(result!.reason!);
      expect(plainReason).toContain("registry-download");
      expect(plainReason).toContain("skill-download");
    });
  });

  describe("config and auth validation", () => {
    it("should show error when no auth is configured", async () => {
      await fs.writeFile(
        configPath,
        JSON.stringify({
          agents: { "claude-code": { profile: { baseProfile: "senior-swe" } } },
        }),
      );

      const result = await noriRegistrySearch.run({
        input: createInput({ prompt: "/nori-registry-search test" }),
      });

      expect(registrarApi.searchPackagesOnRegistry).not.toHaveBeenCalled();
      expect(registrarApi.searchSkills).not.toHaveBeenCalled();
      expect(result).not.toBeNull();
      const plainReason = stripAnsi(result!.reason!);
      expect(plainReason.toLowerCase()).toMatch(/no|organization/);
    });
  });

  describe("installation detection", () => {
    it("should fail when no installation found", async () => {
      const nonInstallDir = await fs.mkdtemp(
        path.join(tmpdir(), "non-install-"),
      );

      const result = await noriRegistrySearch.run({
        input: createInput({
          prompt: "/nori-registry-search test",
          cwd: nonInstallDir,
        }),
      });

      expect(result).not.toBeNull();
      expect(result!.decision).toBe("block");
      const plainReason = stripAnsi(result!.reason!);
      expect(plainReason.toLowerCase()).toContain("no nori installation");

      await fs.rm(nonInstallDir, { recursive: true, force: true });
    });
  });
});
