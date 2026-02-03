/**
 * Tests for @clack/prompts auth wrapper
 */

import * as clack from "@clack/prompts";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { promptForAuth } from "@/cli/prompts/auth.js";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
  group: vi.fn(),
  isCancel: vi.fn(),
  cancel: vi.fn(),
}));

// Mock url utilities
vi.mock("@/utils/url.js", () => ({
  buildWatchtowerUrl: vi.fn(({ orgId }: { orgId: string }) => {
    return `https://${orgId}.tilework.tech`;
  }),
  isValidUrl: vi.fn(({ input }: { input: string }) => {
    try {
      new URL(input);
      return true;
    } catch {
      return false;
    }
  }),
  normalizeUrl: vi.fn(({ baseUrl }: { baseUrl: string }) => {
    return baseUrl.replace(/\/+$/, "");
  }),
}));

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("promptForAuth", () => {
    it("returns null when user enters empty email (skip auth)", async () => {
      // User skips auth by entering empty email
      vi.mocked(clack.group).mockResolvedValueOnce({
        email: "",
        password: null,
        orgId: null,
      });
      vi.mocked(clack.isCancel).mockReturnValue(false);

      const result = await promptForAuth();

      expect(result).toBeNull();
      expect(clack.group).toHaveBeenCalledTimes(1);
    });

    it("returns AuthCredentials when user provides all fields", async () => {
      vi.mocked(clack.group).mockResolvedValueOnce({
        email: "user@example.com",
        password: "secret123",
        orgId: "mycompany",
      });
      vi.mocked(clack.isCancel).mockReturnValue(false);

      const result = await promptForAuth();

      expect(result).toEqual({
        username: "user@example.com",
        password: "secret123",
        organizationUrl: "https://mycompany.tilework.tech",
      });
    });

    it("calls handleCancel and exits when user cancels", async () => {
      const cancelSymbol = Symbol("cancel");
      vi.mocked(clack.group).mockResolvedValueOnce(cancelSymbol as any);
      vi.mocked(clack.isCancel).mockReturnValue(true);

      // Mock process.exit to throw so we can test it was called
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      await expect(promptForAuth()).rejects.toThrow("process.exit called");

      expect(clack.cancel).toHaveBeenCalledWith("Operation cancelled.");
      expect(exitSpy).toHaveBeenCalledWith(0);

      exitSpy.mockRestore();
    });

    it("uses normalizeUrl when user enters a full URL instead of org ID", async () => {
      vi.mocked(clack.group).mockResolvedValueOnce({
        email: "user@example.com",
        password: "secret123",
        orgId: "https://custom.example.com/",
      });
      vi.mocked(clack.isCancel).mockReturnValue(false);

      const result = await promptForAuth();

      expect(result).toEqual({
        username: "user@example.com",
        password: "secret123",
        organizationUrl: "https://custom.example.com",
      });
    });

    it("trims whitespace from email", async () => {
      vi.mocked(clack.group).mockResolvedValueOnce({
        email: "  user@example.com  ",
        password: "secret123",
        orgId: "mycompany",
      });
      vi.mocked(clack.isCancel).mockReturnValue(false);

      const result = await promptForAuth();

      expect(result?.username).toBe("user@example.com");
    });

    it("treats whitespace-only email as skip", async () => {
      vi.mocked(clack.group).mockResolvedValueOnce({
        email: "   ",
        password: null,
        orgId: null,
      });
      vi.mocked(clack.isCancel).mockReturnValue(false);

      const result = await promptForAuth();

      expect(result).toBeNull();
    });
  });
});
