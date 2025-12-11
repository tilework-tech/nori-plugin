/**
 * Tests for CursorProfileLoaderRegistry
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";

import { CursorProfileLoaderRegistry } from "@/cli/features/cursor-agent/profiles/profileLoaderRegistry.js";

describe("CursorProfileLoaderRegistry", () => {
  beforeEach(() => {
    CursorProfileLoaderRegistry.resetInstance();
  });

  afterEach(() => {
    CursorProfileLoaderRegistry.resetInstance();
  });

  describe("getInstance", () => {
    test("returns singleton instance", () => {
      const instance1 = CursorProfileLoaderRegistry.getInstance();
      const instance2 = CursorProfileLoaderRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("getAll", () => {
    test("returns array of profile loaders", () => {
      const registry = CursorProfileLoaderRegistry.getInstance();
      const loaders = registry.getAll();

      expect(Array.isArray(loaders)).toBe(true);
      expect(loaders.length).toBeGreaterThan(0);
    });

    test("includes rules loader", () => {
      const registry = CursorProfileLoaderRegistry.getInstance();
      const loaders = registry.getAll();
      const names = loaders.map((l) => l.name);

      expect(names).toContain("rules");
    });

    test("includes agentsmd loader", () => {
      const registry = CursorProfileLoaderRegistry.getInstance();
      const loaders = registry.getAll();
      const names = loaders.map((l) => l.name);

      expect(names).toContain("agentsmd");
    });

    test("rules loader comes before agentsmd loader", () => {
      const registry = CursorProfileLoaderRegistry.getInstance();
      const loaders = registry.getAll();
      const names = loaders.map((l) => l.name);

      const rulesIndex = names.indexOf("rules");
      const agentsmdIndex = names.indexOf("agentsmd");

      expect(rulesIndex).toBeLessThan(agentsmdIndex);
    });
  });

  describe("getAllReversed", () => {
    test("returns loaders in reverse order", () => {
      const registry = CursorProfileLoaderRegistry.getInstance();
      const loaders = registry.getAll();
      const reversed = registry.getAllReversed();

      expect(reversed.length).toBe(loaders.length);
      expect(reversed[0]).toBe(loaders[loaders.length - 1]);
      expect(reversed[reversed.length - 1]).toBe(loaders[0]);
    });
  });
});
