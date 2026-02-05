/**
 * Tests for @clack/prompts profile selection wrapper
 */

import * as clack from "@clack/prompts";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectProfile } from "@/cli/prompts/profile.js";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  isCancel: vi.fn(),
  cancel: vi.fn(),
}));

describe("profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("selectProfile", () => {
    it("returns selected profile name when user selects", async () => {
      vi.mocked(clack.select).mockResolvedValueOnce("senior-swe");
      vi.mocked(clack.isCancel).mockReturnValue(false);

      const result = await selectProfile({
        profiles: [
          {
            name: "senior-swe",
            description: "Senior software engineer profile",
          },
          { name: "product-manager", description: "Product manager profile" },
        ],
      });

      expect(result).toEqual({ baseProfile: "senior-swe" });
    });

    it("calls handleCancel and exits when user cancels", async () => {
      const cancelSymbol = Symbol("cancel");
      vi.mocked(clack.select).mockResolvedValueOnce(cancelSymbol as any);
      vi.mocked(clack.isCancel).mockReturnValue(true);

      // Mock process.exit to throw so we can test it was called
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      await expect(
        selectProfile({
          profiles: [
            {
              name: "senior-swe",
              description: "Senior software engineer profile",
            },
          ],
        }),
      ).rejects.toThrow("process.exit called");

      expect(clack.cancel).toHaveBeenCalledWith("Operation cancelled.");
      expect(exitSpy).toHaveBeenCalledWith(0);

      exitSpy.mockRestore();
    });

    it("maps profiles to select options with label and hint", async () => {
      vi.mocked(clack.select).mockResolvedValueOnce("senior-swe");
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await selectProfile({
        profiles: [
          {
            name: "senior-swe",
            description: "Senior software engineer profile",
          },
          { name: "product-manager", description: "Product manager profile" },
        ],
      });

      expect(clack.select).toHaveBeenCalledWith({
        message: "Select a profile",
        options: [
          {
            value: "senior-swe",
            label: "senior-swe",
            hint: "Senior software engineer profile",
          },
          {
            value: "product-manager",
            label: "product-manager",
            hint: "Product manager profile",
          },
        ],
      });
    });

    it("throws error when profiles array is empty", async () => {
      await expect(
        selectProfile({
          profiles: [],
        }),
      ).rejects.toThrow("No profiles available for selection");

      // Select should not have been called
      expect(clack.select).not.toHaveBeenCalled();
    });

    it("uses custom message when provided", async () => {
      vi.mocked(clack.select).mockResolvedValueOnce("senior-swe");
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await selectProfile({
        profiles: [
          {
            name: "senior-swe",
            description: "Senior software engineer profile",
          },
        ],
        message: "Choose your skillset",
      });

      expect(clack.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Choose your skillset",
        }),
      );
    });
  });
});
