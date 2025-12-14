/**
 * Tests for format utilities
 */

import { describe, it, expect } from "vitest";

import {
  formatSuccess,
  formatError,
  calculatePrefixLines,
  formatWithLineClear,
} from "./format.js";

// ANSI color codes for verification
const GREEN = "\x1b[0;32m";
const RED = "\x1b[0;31m";
const NC = "\x1b[0m"; // No Color / Reset

describe("formatSuccess", () => {
  it("should wrap single-word message with green color codes", () => {
    const result = formatSuccess({ message: "Hello" });

    expect(result).toBe(`${GREEN}Hello${NC}`);
  });

  it("should wrap each word separately for multi-word messages", () => {
    const result = formatSuccess({ message: "Line 1\nLine 2\nLine 3" });

    // Each word should have its own color codes
    expect(result).toBe(
      `${GREEN}Line${NC} ${GREEN}1${NC}\n${GREEN}Line${NC} ${GREEN}2${NC}\n${GREEN}Line${NC} ${GREEN}3${NC}`,
    );
  });

  it("should handle empty string", () => {
    const result = formatSuccess({ message: "" });

    expect(result).toBe("");
  });

  it("should handle message with only newlines", () => {
    const result = formatSuccess({ message: "\n\n" });

    // Empty lines produce empty strings
    expect(result).toBe("\n\n");
  });

  it("should handle message ending with newline", () => {
    const result = formatSuccess({ message: "Hello\n" });

    expect(result).toBe(`${GREEN}Hello${NC}\n`);
  });
});

describe("formatError", () => {
  it("should wrap single-word message with red color codes", () => {
    const result = formatError({ message: "Error" });

    expect(result).toBe(`${RED}Error${NC}`);
  });

  it("should wrap each word separately for multi-word messages", () => {
    const result = formatError({ message: "Error 1\nError 2" });

    expect(result).toBe(
      `${RED}Error${NC} ${RED}1${NC}\n${RED}Error${NC} ${RED}2${NC}`,
    );
  });

  it("should handle empty string", () => {
    const result = formatError({ message: "" });

    expect(result).toBe("");
  });

  it("should handle message with multiple consecutive newlines", () => {
    const result = formatError({ message: "Error\n\nDetails" });

    expect(result).toBe(`${RED}Error${NC}\n\n${RED}Details${NC}`);
  });
});

describe("terminal re-wrap resilience", () => {
  /**
   * These tests verify that colors persist when Claude Code's terminal
   * re-wraps our output at a narrower width than we expected.
   *
   * The key insight: we can't predict the actual terminal width, so we
   * must color each word individually to survive any re-wrapping.
   */

  it("should color each word so colors persist after re-wrapping", () => {
    const message = "Hello world test";
    const result = formatSuccess({ message });

    // Each word should be individually colored
    // Format: GREEN + word + NC for each word, joined by spaces
    expect(result).toBe(
      `${GREEN}Hello${NC} ${GREEN}world${NC} ${GREEN}test${NC}`,
    );
  });

  it("should handle multi-word lines with explicit newlines", () => {
    const message = "Line one here\nLine two here";
    const result = formatSuccess({ message });

    // Each word on each line should be colored
    expect(result).toBe(
      `${GREEN}Line${NC} ${GREEN}one${NC} ${GREEN}here${NC}\n${GREEN}Line${NC} ${GREEN}two${NC} ${GREEN}here${NC}`,
    );
  });

  it("should handle multiple spaces between words", () => {
    const message = "Hello  world";
    const result = formatSuccess({ message });

    // Multiple spaces should be preserved, each word colored
    expect(result).toBe(`${GREEN}Hello${NC}  ${GREEN}world${NC}`);
  });

  it("should handle leading and trailing spaces", () => {
    const message = "  Hello world  ";
    const result = formatSuccess({ message });

    // Leading/trailing spaces preserved, words colored
    expect(result).toBe(`  ${GREEN}Hello${NC} ${GREEN}world${NC}  `);
  });

  it("should handle empty words from multiple spaces gracefully", () => {
    const message = "a   b";
    const result = formatSuccess({ message });

    // Three spaces between a and b
    expect(result).toBe(`${GREEN}a${NC}   ${GREEN}b${NC}`);
  });

  it("should work with formatError as well", () => {
    const message = "Error message here";
    const result = formatError({ message });

    expect(result).toBe(`${RED}Error${NC} ${RED}message${NC} ${RED}here${NC}`);
  });

  it("should handle real-world message that caused the bug", () => {
    const message =
      "Session transcripts are now DISABLED. Your conversations will not be summarized or stored.";
    const result = formatSuccess({ message });

    // Every word should start with GREEN and end with NC
    const words = message.split(" ");
    for (const word of words) {
      expect(result).toContain(`${GREEN}${word}${NC}`);
    }
  });
});

describe("calculatePrefixLines", () => {
  /**
   * Claude Code displays hook failures with this prefix format:
   * "SessionEnd hook [node {hookPath}] failed: "
   *
   * We need to calculate how many terminal lines this takes so we can
   * use ANSI escape codes to clear them.
   */

  it("should return 1 line for short hook path at wide terminal", () => {
    const result = calculatePrefixLines({
      hookPath: "/short/path.js",
      terminalWidth: 200,
    });

    // "SessionEnd hook [node /short/path.js] failed: " = 49 chars < 200
    expect(result).toBe(1);
  });

  it("should return 2 lines when prefix wraps once", () => {
    const result = calculatePrefixLines({
      hookPath:
        "/home/user/code/nori/nori-profiles/build/src/cli/features/claude-code/hooks/config/summarize-notification.js",
      terminalWidth: 80,
    });

    // Prefix is ~140 chars, at 80 width = ceil(140/80) = 2 lines
    expect(result).toBe(2);
  });

  it("should return 3 lines when prefix wraps twice", () => {
    const result = calculatePrefixLines({
      hookPath:
        "/home/user/code/nori/nori-profiles/build/src/cli/features/claude-code/hooks/config/summarize-notification.js",
      terminalWidth: 60,
    });

    // Prefix is ~140 chars, at 60 width = ceil(140/60) = 3 lines
    expect(result).toBe(3);
  });

  it("should handle very narrow terminal", () => {
    const result = calculatePrefixLines({
      hookPath: "/path/to/hook.js",
      terminalWidth: 20,
    });

    // "SessionEnd hook [node /path/to/hook.js] failed: " = 50 chars
    // At 20 width = ceil(50/20) = 3 lines
    expect(result).toBe(3);
  });

  it("should default to 80 columns when terminalWidth is 0", () => {
    const result = calculatePrefixLines({
      hookPath: "/short/path.js",
      terminalWidth: 0,
    });

    // Should use 80 as default, prefix ~49 chars = 1 line
    expect(result).toBe(1);
  });

  it("should default to 80 columns when terminalWidth is undefined", () => {
    const result = calculatePrefixLines({
      hookPath: "/short/path.js",
    });

    // Should use 80 as default, prefix ~49 chars = 1 line
    expect(result).toBe(1);
  });
});

describe("formatWithLineClear", () => {
  /**
   * formatWithLineClear prepends ANSI escape codes to move the cursor up
   * and clear the Claude Code prefix, then applies success/error coloring.
   *
   * ANSI codes reference:
   * - \x1b[{n}A = cursor up n lines
   * - \x1b[J = clear from cursor to end of screen
   */

  it("should prepend ANSI codes to clear 1 line for short prefix", () => {
    const result = formatWithLineClear({
      message: "Test message",
      hookPath: "/short/path.js",
      terminalWidth: 200,
      isSuccess: true,
    });

    // Should start with carriage return + cursor up 1 line + clear to end
    expect(result).toMatch(/^\r\x1b\[1A\x1b\[J/);
  });

  it("should prepend ANSI codes to clear 2 lines for medium prefix", () => {
    const result = formatWithLineClear({
      message: "Test message",
      hookPath:
        "/home/user/code/nori/nori-profiles/build/src/cli/features/claude-code/hooks/config/summarize-notification.js",
      terminalWidth: 80,
      isSuccess: true,
    });

    // Should start with carriage return + cursor up 2 lines + clear to end
    expect(result).toMatch(/^\r\x1b\[2A\x1b\[J/);
  });

  it("should apply green coloring for success messages", () => {
    const result = formatWithLineClear({
      message: "Success",
      hookPath: "/path.js",
      terminalWidth: 200,
      isSuccess: true,
    });

    // Should contain green color code
    expect(result).toContain(GREEN);
    expect(result).toContain("Success");
  });

  it("should apply red coloring for error messages", () => {
    const result = formatWithLineClear({
      message: "Error",
      hookPath: "/path.js",
      terminalWidth: 200,
      isSuccess: false,
    });

    // Should contain red color code
    expect(result).toContain(RED);
    expect(result).toContain("Error");
  });

  it("should handle multi-line messages with per-word coloring", () => {
    const result = formatWithLineClear({
      message: "Line one\nLine two",
      hookPath: "/path.js",
      terminalWidth: 200,
      isSuccess: true,
    });

    // Each word should be colored
    expect(result).toContain(`${GREEN}Line${NC}`);
    expect(result).toContain(`${GREEN}one${NC}`);
    expect(result).toContain(`${GREEN}two${NC}`);
  });

  it("should use process.stdout.columns when terminalWidth not provided", () => {
    // This test verifies the function works without explicit terminalWidth
    // The actual width will come from process.stdout.columns or default to 80
    const result = formatWithLineClear({
      message: "Test",
      hookPath: "/short/path.js",
      isSuccess: true,
    });

    // Should still have ANSI clear codes at start (carriage return + cursor up + clear)
    expect(result).toMatch(/^\r\x1b\[\d+A\x1b\[J/);
  });
});
