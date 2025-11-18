import { existsSync, readFileSync } from "fs";

import { describe, it, expect, vi, beforeEach } from "vitest";

import { ConfigManager } from "./base.js";

vi.mock("fs");

describe("ConfigManager", () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty object when config file does not exist", () => {
    mockExistsSync.mockReturnValue(false);

    const result = ConfigManager.loadConfig();

    expect(result).toEqual({});
  });

  // Race condition scenarios: these test cases cover situations where
  // analytics code calls loadConfig() before/during config file creation
  it("should return empty object when config file is empty (race condition)", () => {
    // Simulates reading the file after creation but before write completes
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("");

    const result = ConfigManager.loadConfig();

    expect(result).toEqual({});
  });

  it("should return empty object when config file contains whitespace only (race condition)", () => {
    // Simulates partial file write during race condition
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("   \n  \t  ");

    const result = ConfigManager.loadConfig();

    expect(result).toEqual({});
  });

  // Unexpected error scenarios: truly malformed content should still be caught
  it("should return empty object when config file contains invalid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("{invalid json}");

    const result = ConfigManager.loadConfig();

    expect(result).toEqual({});
  });

  // Happy path: normal config loading
  it("should parse and return valid config", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        username: "test@example.com",
        password: "test123",
        organizationUrl: "https://example.com",
      }),
    );

    const result = ConfigManager.loadConfig();

    expect(result).toEqual({
      username: "test@example.com",
      password: "test123",
      organizationUrl: "https://example.com",
    });
  });
});
