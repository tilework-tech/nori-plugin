/**
 * Tests for @clack/prompts confirm wrapper
 */

import * as clack from "@clack/prompts";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { confirmAction } from "@/cli/prompts/confirm.js";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
  confirm: vi.fn(),
  isCancel: vi.fn(),
  cancel: vi.fn(),
}));

describe("confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("confirmAction", () => {
    it("returns true when user confirms", async () => {
      vi.mocked(clack.confirm).mockResolvedValueOnce(true);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      const result = await confirmAction({ message: "Proceed?" });

      expect(result).toBe(true);
      expect(clack.confirm).toHaveBeenCalledWith({
        message: "Proceed?",
      });
    });

    it("returns false when user declines", async () => {
      vi.mocked(clack.confirm).mockResolvedValueOnce(false);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      const result = await confirmAction({ message: "Proceed?" });

      expect(result).toBe(false);
    });

    it("calls handleCancel and exits when user cancels", async () => {
      const cancelSymbol = Symbol("cancel");
      vi.mocked(clack.confirm).mockResolvedValueOnce(cancelSymbol as any);
      vi.mocked(clack.isCancel).mockReturnValue(true);

      // Mock process.exit to throw so we can test it was called
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      await expect(confirmAction({ message: "Proceed?" })).rejects.toThrow(
        "process.exit called",
      );

      expect(clack.cancel).toHaveBeenCalledWith("Operation cancelled.");
      expect(exitSpy).toHaveBeenCalledWith(0);

      exitSpy.mockRestore();
    });

    it("passes initialValue when provided", async () => {
      vi.mocked(clack.confirm).mockResolvedValueOnce(true);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await confirmAction({ message: "Proceed?", initialValue: false });

      expect(clack.confirm).toHaveBeenCalledWith({
        message: "Proceed?",
        initialValue: false,
      });
    });
  });
});
