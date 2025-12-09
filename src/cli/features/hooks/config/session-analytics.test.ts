/**
 * Tests for session-analytics SessionEnd hook
 *
 * This hook displays statistics about skill usage and checklist compliance
 * at the end of a Claude Code session.
 */

import { spawn } from "child_process";
import * as path from "path";

import { describe, it, expect } from "vitest";

// Use process.cwd() which points to project root in vitest
const projectRoot = process.cwd();

// Use the TypeScript source file with tsx for direct execution
const hookScriptPath = path.join(
  projectRoot,
  "src/cli/features/hooks/config/session-analytics.ts",
);

type SessionEndInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
};

type HookOutput = {
  systemMessage?: string;
};

/**
 * Run the hook script with given input
 * @param args - Arguments object
 * @param args.input - Hook input JSON
 * @param args.transcriptContent - Content to write to a mock transcript file
 *
 * @returns Hook output JSON and exit code
 */
const runHook = async (args: {
  input: SessionEndInput;
  transcriptContent: string;
}): Promise<{
  output: HookOutput | null;
  exitCode: number;
  stderr: string;
}> => {
  const { input, transcriptContent } = args;
  const fs = await import("fs/promises");
  const os = await import("os");

  // Create a temp file with transcript content
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "session-analytics-"),
  );
  const transcriptPath = path.join(tempDir, "transcript.jsonl");
  await fs.writeFile(transcriptPath, transcriptContent);

  // Update input with actual transcript path
  const inputWithPath = { ...input, transcript_path: transcriptPath };

  return new Promise((resolve) => {
    // Use npx tsx to run TypeScript file directly
    const proc = spawn("npx", ["tsx", hookScriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", async (code) => {
      // Clean up temp file
      try {
        await fs.rm(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }

      let output: HookOutput | null = null;
      if (stdout.trim()) {
        try {
          output = JSON.parse(stdout);
        } catch {
          // Invalid JSON output
        }
      }
      resolve({ output, exitCode: code ?? 0, stderr });
    });

    // Write input to stdin
    proc.stdin.write(JSON.stringify(inputWithPath));
    proc.stdin.end();
  });
};

/**
 * Create a transcript line for a user message
 * @param args - Arguments object
 * @param args.content - The message content
 *
 * @returns JSON string representing a user message transcript line
 */
const createUserMessage = (args: { content: string }): string => {
  const { content } = args;
  return JSON.stringify({
    type: "user",
    message: { role: "user", content },
  });
};

/**
 * Create a transcript line for an assistant message
 * @param args - Arguments object
 * @param args.content - The message content
 *
 * @returns JSON string representing an assistant message transcript line
 */
const createAssistantMessage = (args: { content: string }): string => {
  const { content } = args;
  return JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content },
  });
};

/**
 * Create a transcript line for a tool use (Read tool)
 * @param args - Arguments object
 * @param args.filePath - Path to the file being read
 *
 * @returns JSON string representing a Read tool use transcript line
 */
const createReadToolUse = (args: { filePath: string }): string => {
  const { filePath } = args;
  return JSON.stringify({
    type: "tool_use",
    tool_use: {
      tool_name: "Read",
      input: { file_path: filePath },
    },
  });
};

/**
 * Create a transcript line for a tool use (TodoWrite tool)
 * @param args - Arguments object
 * @param args.todos - Array of todo items
 *
 * @returns JSON string representing a TodoWrite tool use transcript line
 */
const createTodoWriteToolUse = (args: {
  todos: Array<{ content: string; status: string }>;
}): string => {
  const { todos } = args;
  return JSON.stringify({
    type: "tool_use",
    tool_use: {
      tool_name: "TodoWrite",
      input: { todos },
    },
  });
};

/**
 * Create a transcript line for a tool use (Skill tool)
 * @param args - Arguments object
 * @param args.skill - Name of the skill being used
 *
 * @returns JSON string representing a Skill tool use transcript line
 */
const createSkillToolUse = (args: { skill: string }): string => {
  const { skill } = args;
  return JSON.stringify({
    type: "tool_use",
    tool_use: {
      tool_name: "Skill",
      input: { skill },
    },
  });
};

describe("session-analytics hook", { timeout: 30000 }, () => {
  const baseInput: SessionEndInput = {
    session_id: "test-session",
    transcript_path: "/tmp/test.jsonl",
    cwd: "/tmp",
  };

  it("should output nothing when transcript has no user messages", async () => {
    const transcriptContent = [
      createAssistantMessage({ content: "Hello!" }),
    ].join("\n");

    const { output, exitCode } = await runHook({
      input: baseInput,
      transcriptContent,
    });

    expect(exitCode).toBe(0);
    expect(output).toBeNull();
  });

  it("should count skill invocations from Read tool calls to SKILL.md files", async () => {
    const transcriptContent = [
      createUserMessage({ content: "Help me with TDD" }),
      createReadToolUse({
        filePath: "/home/user/.claude/skills/test-driven-development/SKILL.md",
      }),
      createAssistantMessage({ content: "I've read the skill." }),
      createReadToolUse({
        filePath: "/home/user/.claude/skills/brainstorming/SKILL.md",
      }),
      createReadToolUse({
        filePath: "/home/user/.claude/skills/test-driven-development/SKILL.md",
      }),
    ].join("\n");

    const { output, exitCode } = await runHook({
      input: baseInput,
      transcriptContent,
    });

    expect(exitCode).toBe(0);
    expect(output).not.toBeNull();
    expect(output?.systemMessage).toContain("test-driven-development");
    expect(output?.systemMessage).toContain("brainstorming");
    // TDD was read twice
    expect(output?.systemMessage).toMatch(/test-driven-development.*2/);
  });

  it("should count skill invocations from Skill tool usage", async () => {
    const transcriptContent = [
      createUserMessage({ content: "Use the recall skill" }),
      createSkillToolUse({ skill: "recall" }),
      createAssistantMessage({ content: "Using recall..." }),
      createSkillToolUse({ skill: "memorize" }),
    ].join("\n");

    const { output, exitCode } = await runHook({
      input: baseInput,
      transcriptContent,
    });

    expect(exitCode).toBe(0);
    expect(output).not.toBeNull();
    expect(output?.systemMessage).toContain("recall");
    expect(output?.systemMessage).toContain("memorize");
  });

  it("should detect checklist compliance when TodoWrite is used", async () => {
    const transcriptContent = [
      createUserMessage({ content: "Do something" }),
      createTodoWriteToolUse({
        todos: [{ content: "Task 1", status: "in_progress" }],
      }),
      createAssistantMessage({ content: "Working on it..." }),
    ].join("\n");

    const { output, exitCode } = await runHook({
      input: baseInput,
      transcriptContent,
    });

    expect(exitCode).toBe(0);
    expect(output).not.toBeNull();
    // Should indicate checklist was followed
    expect(output?.systemMessage).toMatch(/checklist.*followed|✓.*checklist/i);
  });

  it("should report checklist not followed when TodoWrite not used", async () => {
    const transcriptContent = [
      createUserMessage({ content: "Do something" }),
      createAssistantMessage({ content: "Done!" }),
    ].join("\n");

    const { output, exitCode } = await runHook({
      input: baseInput,
      transcriptContent,
    });

    expect(exitCode).toBe(0);
    expect(output).not.toBeNull();
    // Should indicate checklist was NOT followed
    expect(output?.systemMessage).toMatch(
      /checklist.*not followed|✗.*checklist/i,
    );
  });

  it("should show zero skills when none were used", async () => {
    const transcriptContent = [
      createUserMessage({ content: "Hello" }),
      createAssistantMessage({ content: "Hi there!" }),
    ].join("\n");

    const { output, exitCode } = await runHook({
      input: baseInput,
      transcriptContent,
    });

    expect(exitCode).toBe(0);
    expect(output).not.toBeNull();
    // Should show no skills or "0 skills"
    expect(output?.systemMessage).toMatch(/no skills|0 skills/i);
  });

  it("should format output as systemMessage JSON", async () => {
    const transcriptContent = [
      createUserMessage({ content: "Help me" }),
      createAssistantMessage({ content: "Sure!" }),
    ].join("\n");

    const { output, exitCode } = await runHook({
      input: baseInput,
      transcriptContent,
    });

    expect(exitCode).toBe(0);
    expect(output).not.toBeNull();
    expect(output).toHaveProperty("systemMessage");
    expect(typeof output?.systemMessage).toBe("string");
  });

  it("should handle malformed JSON lines gracefully", async () => {
    const transcriptContent = [
      createUserMessage({ content: "Hello" }),
      "this is not valid json",
      '{"incomplete": ',
      createAssistantMessage({ content: "Hi!" }),
    ].join("\n");

    const { output, exitCode } = await runHook({
      input: baseInput,
      transcriptContent,
    });

    expect(exitCode).toBe(0);
    // Should not crash, should still produce output
    expect(output).not.toBeNull();
  });

  it("should handle empty transcript gracefully", async () => {
    const transcriptContent = "";

    const { output, exitCode } = await runHook({
      input: baseInput,
      transcriptContent,
    });

    expect(exitCode).toBe(0);
    expect(output).toBeNull();
  });
});
