import { describe, expect, it } from "vitest";

import { normalizeUrl } from "./url";

describe("normalizeUrl", () => {
  it("should remove trailing slashes from base URL", () => {
    const result = normalizeUrl({
      baseUrl: "https://example.com/",
      path: null,
    });

    expect(result).toBe("https://example.com");
  });

  it("should handle multiple trailing slashes", () => {
    const result = normalizeUrl({
      baseUrl: "https://example.com///",
      path: null,
    });

    expect(result).toBe("https://example.com");
  });

  it("should join base URL and path correctly", () => {
    const result = normalizeUrl({
      baseUrl: "https://example.com/",
      path: "/api/endpoint",
    });

    expect(result).toBe("https://example.com/api/endpoint");
  });

  it("should handle path without leading slash", () => {
    const result = normalizeUrl({
      baseUrl: "https://example.com",
      path: "api/endpoint",
    });

    expect(result).toBe("https://example.com/api/endpoint");
  });

  it("should handle base URL without trailing slash and path with leading slash", () => {
    const result = normalizeUrl({
      baseUrl: "https://example.com",
      path: "/api/endpoint",
    });

    expect(result).toBe("https://example.com/api/endpoint");
  });

  it("should prevent double slashes", () => {
    const result = normalizeUrl({
      baseUrl: "https://example.com/",
      path: "/api/endpoint",
    });

    expect(result).toBe("https://example.com/api/endpoint");
  });

  it("should handle empty path", () => {
    const result = normalizeUrl({
      baseUrl: "https://example.com/",
      path: "",
    });

    expect(result).toBe("https://example.com");
  });

  it("should handle localhost URLs", () => {
    const result = normalizeUrl({
      baseUrl: "http://localhost:3000/",
      path: "/api/test",
    });

    expect(result).toBe("http://localhost:3000/api/test");
  });

  it("should handle paths with query params", () => {
    const result = normalizeUrl({
      baseUrl: "https://example.com",
      path: "/api/test?param=value",
    });

    expect(result).toBe("https://example.com/api/test?param=value");
  });
});
