import { afterEach, beforeAll, vi } from "vitest";

// Set test environment
beforeAll(() => {
  process.env.NODE_ENV = "test";
});

// Clean up resources after each test
afterEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks();
});
