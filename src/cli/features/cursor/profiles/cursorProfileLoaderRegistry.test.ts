/**
 * Tests for CursorProfileLoaderRegistry
 * Verifies singleton pattern, loader registration, and ordering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import type { CursorProfileLoaderRegistry as CursorProfileLoaderRegistryType } from "./cursorProfileLoaderRegistry.js";

// We need to reset the singleton between tests
let CursorProfileLoaderRegistry: typeof CursorProfileLoaderRegistryType;

describe("CursorProfileLoaderRegistry", () => {
  beforeEach(async () => {
    // Reset module cache to get fresh singleton
    vi.resetModules();
    const module = await import("./cursorProfileLoaderRegistry.js");
    CursorProfileLoaderRegistry = module.CursorProfileLoaderRegistry;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getInstance", () => {
    it("should return a singleton instance", () => {
      const instance1 = CursorProfileLoaderRegistry.getInstance();
      const instance2 = CursorProfileLoaderRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("getAll", () => {
    it("should return all registered loaders", () => {
      const registry = CursorProfileLoaderRegistry.getInstance();
      const loaders = registry.getAll();

      expect(loaders).toBeDefined();
      expect(Array.isArray(loaders)).toBe(true);
      expect(loaders.length).toBeGreaterThan(0);
    });

    it("should include cursorSkillsLoader", () => {
      const registry = CursorProfileLoaderRegistry.getInstance();
      const loaders = registry.getAll();

      const hasSkillsLoader = loaders.some(
        (loader) => loader.name === "cursor-skills",
      );
      expect(hasSkillsLoader).toBe(true);
    });

    it("should include cursorAgentsMdLoader", () => {
      const registry = CursorProfileLoaderRegistry.getInstance();
      const loaders = registry.getAll();

      const hasAgentsMdLoader = loaders.some(
        (loader) => loader.name === "cursor-agentsmd",
      );
      expect(hasAgentsMdLoader).toBe(true);
    });

    it("should register skills loader before agentsmd loader (order matters)", () => {
      const registry = CursorProfileLoaderRegistry.getInstance();
      const loaders = registry.getAll();

      const skillsIndex = loaders.findIndex(
        (loader) => loader.name === "cursor-skills",
      );
      const agentsMdIndex = loaders.findIndex(
        (loader) => loader.name === "cursor-agentsmd",
      );

      expect(skillsIndex).toBeLessThan(agentsMdIndex);
    });

    it("should return loaders with CursorProfileLoader interface properties", () => {
      const registry = CursorProfileLoaderRegistry.getInstance();
      const loaders = registry.getAll();

      for (const loader of loaders) {
        expect(loader).toHaveProperty("name");
        expect(loader).toHaveProperty("description");
        expect(loader).toHaveProperty("install");
        expect(loader).toHaveProperty("uninstall");
        expect(typeof loader.name).toBe("string");
        expect(typeof loader.description).toBe("string");
        expect(typeof loader.install).toBe("function");
        expect(typeof loader.uninstall).toBe("function");
      }
    });
  });

  describe("getAllReversed", () => {
    it("should return loaders in reverse order", () => {
      const registry = CursorProfileLoaderRegistry.getInstance();
      const loaders = registry.getAll();
      const reversedLoaders = registry.getAllReversed();

      expect(reversedLoaders.length).toBe(loaders.length);

      // Verify order is reversed
      for (let i = 0; i < loaders.length; i++) {
        expect(reversedLoaders[i]).toBe(loaders[loaders.length - 1 - i]);
      }
    });
  });
});
