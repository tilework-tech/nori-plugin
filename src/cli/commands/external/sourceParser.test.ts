/**
 * Tests for GitHub URL source parser
 */

import { describe, it, expect } from "vitest";

import { parseGitHubSource } from "./sourceParser.js";

describe("parseGitHubSource", () => {
  describe("full GitHub URLs", () => {
    it("should parse https://github.com/owner/repo", () => {
      const result = parseGitHubSource({
        source: "https://github.com/vercel-labs/agent-skills",
      });

      expect(result).toEqual({
        url: "https://github.com/vercel-labs/agent-skills.git",
        ref: null,
        subpath: null,
        skillFilter: null,
      });
    });

    it("should parse https://github.com/owner/repo.git", () => {
      const result = parseGitHubSource({
        source: "https://github.com/vercel-labs/agent-skills.git",
      });

      expect(result).toEqual({
        url: "https://github.com/vercel-labs/agent-skills.git",
        ref: null,
        subpath: null,
        skillFilter: null,
      });
    });

    it("should parse URL with tree/branch", () => {
      const result = parseGitHubSource({
        source: "https://github.com/owner/repo/tree/main",
      });

      expect(result).toEqual({
        url: "https://github.com/owner/repo.git",
        ref: "main",
        subpath: null,
        skillFilter: null,
      });
    });

    it("should parse URL with tree/branch/path", () => {
      const result = parseGitHubSource({
        source:
          "https://github.com/owner/repo/tree/develop/skills/frontend-design",
      });

      expect(result).toEqual({
        url: "https://github.com/owner/repo.git",
        ref: "develop",
        subpath: "skills/frontend-design",
        skillFilter: null,
      });
    });

    it("should parse URL with tree/branch/deep/path", () => {
      const result = parseGitHubSource({
        source: "https://github.com/owner/repo/tree/main/path/to/nested/skills",
      });

      expect(result).toEqual({
        url: "https://github.com/owner/repo.git",
        ref: "main",
        subpath: "path/to/nested/skills",
        skillFilter: null,
      });
    });
  });

  describe("shorthand format", () => {
    it("should parse owner/repo shorthand", () => {
      const result = parseGitHubSource({
        source: "vercel-labs/agent-skills",
      });

      expect(result).toEqual({
        url: "https://github.com/vercel-labs/agent-skills.git",
        ref: null,
        subpath: null,
        skillFilter: null,
      });
    });

    it("should parse owner/repo with subpath", () => {
      const result = parseGitHubSource({
        source: "vercel-labs/agent-skills/skills/frontend-design",
      });

      expect(result).toEqual({
        url: "https://github.com/vercel-labs/agent-skills.git",
        ref: null,
        subpath: "skills/frontend-design",
        skillFilter: null,
      });
    });

    it("should parse owner/repo@skill-name filter", () => {
      const result = parseGitHubSource({
        source: "vercel-labs/agent-skills@frontend-design",
      });

      expect(result).toEqual({
        url: "https://github.com/vercel-labs/agent-skills.git",
        ref: null,
        subpath: null,
        skillFilter: "frontend-design",
      });
    });
  });

  describe("SSH URLs", () => {
    it("should parse git@github.com:owner/repo.git", () => {
      const result = parseGitHubSource({
        source: "git@github.com:owner/repo.git",
      });

      expect(result).toEqual({
        url: "git@github.com:owner/repo.git",
        ref: null,
        subpath: null,
        skillFilter: null,
      });
    });
  });

  describe("invalid sources", () => {
    it("should return null for non-GitHub URLs", () => {
      const result = parseGitHubSource({
        source: "https://gitlab.com/owner/repo",
      });

      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = parseGitHubSource({ source: "" });

      expect(result).toBeNull();
    });

    it("should return null for local paths", () => {
      const result = parseGitHubSource({ source: "./local/path" });

      expect(result).toBeNull();
    });

    it("should return null for absolute paths", () => {
      const result = parseGitHubSource({ source: "/absolute/path" });

      expect(result).toBeNull();
    });

    it("should return null for single word (not owner/repo)", () => {
      const result = parseGitHubSource({ source: "just-a-name" });

      expect(result).toBeNull();
    });
  });
});
