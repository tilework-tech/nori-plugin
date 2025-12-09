#!/usr/bin/env node

/**
 * Session Analytics Hook
 *
 * This script is called by Claude Code hooks on SessionEnd events.
 * It displays statistics about skill usage and checklist compliance during the session.
 */

import * as fs from "fs/promises";

type SessionEndInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
};

type TranscriptMessage = {
  type: string;
  message?: {
    role?: string;
    content?:
      | string
      | Array<{ type: string; text?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  };
  tool_use?: {
    tool_name?: string;
    input?: {
      file_path?: string;
      skill?: string;
      todos?: Array<unknown>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type SkillUsage = Map<string, number>;

/**
 * Parse newline-delimited JSON transcript
 * @param args - Configuration arguments
 * @param args.content - Raw transcript content
 *
 * @returns Array of parsed transcript messages
 */
const parseTranscript = (args: {
  content: string;
}): Array<TranscriptMessage> => {
  const { content } = args;
  const lines = content.trim().split("\n");
  const messages: Array<TranscriptMessage> = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const parsed = JSON.parse(line) as TranscriptMessage;
      messages.push(parsed);
    } catch {
      // Skip invalid JSON lines
    }
  }

  return messages;
};

/**
 * Check if message content is non-empty
 * @param args - Configuration arguments
 * @param args.content - Message content in various formats
 *
 * @returns True if content is meaningful, false if empty
 */
const hasContent = (args: {
  content:
    | string
    | Array<{ type: string; text?: string; [key: string]: unknown }>
    | undefined;
}): boolean => {
  const { content } = args;

  if (content == null) return false;

  if (typeof content === "string") {
    return content.trim().length > 0;
  }

  if (Array.isArray(content)) {
    return content.some((item) => {
      if (item.type === "text" && (item as { text?: string }).text) {
        return (item as { text?: string }).text!.trim().length > 0;
      }
      return false;
    });
  }

  return false;
};

/**
 * Check if transcript has any user messages with content
 * @param args - Configuration arguments
 * @param args.messages - Parsed transcript messages
 *
 * @returns True if there are user messages with content
 */
const hasUserMessages = (args: {
  messages: Array<TranscriptMessage>;
}): boolean => {
  const { messages } = args;

  return messages.some((msg) => {
    if (msg.type === "user" && msg.message) {
      return hasContent({ content: msg.message.content });
    }
    return false;
  });
};

/**
 * Extract skill name from a SKILL.md file path
 * @param args - Configuration arguments
 * @param args.filePath - Path to the SKILL.md file
 *
 * @returns Skill name or null if not a valid skill path
 */
const extractSkillNameFromPath = (args: {
  filePath: string;
}): string | null => {
  const { filePath } = args;

  // Match patterns like /skills/skill-name/SKILL.md or /skills/skill-name/SKILL.MD
  const match = filePath.match(/\/skills\/([^/]+)\/SKILL\.md$/i);
  if (match) {
    return match[1];
  }

  return null;
};

/**
 * Count skill usage from transcript messages
 * @param args - Configuration arguments
 * @param args.messages - Parsed transcript messages
 *
 * @returns Map of skill names to usage counts
 */
const countSkillUsage = (args: {
  messages: Array<TranscriptMessage>;
}): SkillUsage => {
  const { messages } = args;
  const skillUsage: SkillUsage = new Map();

  for (const msg of messages) {
    // Check for Read tool calls to SKILL.md files
    if (msg.type === "tool_use" && msg.tool_use?.tool_name === "Read") {
      const filePath = msg.tool_use.input?.file_path;
      if (filePath) {
        const skillName = extractSkillNameFromPath({ filePath });
        if (skillName) {
          skillUsage.set(skillName, (skillUsage.get(skillName) || 0) + 1);
        }
      }
    }

    // Check for Skill tool usage
    if (msg.type === "tool_use" && msg.tool_use?.tool_name === "Skill") {
      const skill = msg.tool_use.input?.skill;
      if (skill) {
        skillUsage.set(skill, (skillUsage.get(skill) || 0) + 1);
      }
    }
  }

  return skillUsage;
};

/**
 * Check if TodoWrite was used in the session
 * @param args - Configuration arguments
 * @param args.messages - Parsed transcript messages
 *
 * @returns True if TodoWrite was used
 */
const wasTodoWriteUsed = (args: {
  messages: Array<TranscriptMessage>;
}): boolean => {
  const { messages } = args;

  return messages.some((msg) => {
    return msg.type === "tool_use" && msg.tool_use?.tool_name === "TodoWrite";
  });
};

/**
 * Format skill usage as a string
 * @param args - Configuration arguments
 * @param args.skillUsage - Map of skill names to usage counts
 *
 * @returns Formatted string
 */
const formatSkillUsage = (args: { skillUsage: SkillUsage }): string => {
  const { skillUsage } = args;

  if (skillUsage.size === 0) {
    return "No skills referenced";
  }

  const skillList = Array.from(skillUsage.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .map(([name, count]) => `  - ${name} (${count}x)`)
    .join("\n");

  return `Skills referenced:\n${skillList}`;
};

/**
 * Format the analytics output
 * @param args - Configuration arguments
 * @param args.skillUsage - Map of skill names to usage counts
 * @param args.checklistFollowed - Whether the checklist was followed
 *
 * @returns Formatted output string
 */
const formatOutput = (args: {
  skillUsage: SkillUsage;
  checklistFollowed: boolean;
}): string => {
  const { skillUsage, checklistFollowed } = args;

  const parts: Array<string> = [];

  // Add header
  parts.push("📊 Session Analytics");
  parts.push("─".repeat(20));

  // Add skill usage
  parts.push(formatSkillUsage({ skillUsage }));

  // Add checklist status
  parts.push("");
  if (checklistFollowed) {
    parts.push("✓ Nori checklist was followed");
  } else {
    parts.push("✗ Nori checklist was not followed");
  }

  return parts.join("\n");
};

/**
 * Read transcript file
 * @param args - Configuration arguments
 * @param args.transcriptPath - Path to transcript file
 *
 * @returns Transcript content as string
 */
const readTranscript = async (args: {
  transcriptPath: string;
}): Promise<string> => {
  const { transcriptPath } = args;
  const content = await fs.readFile(transcriptPath, "utf-8");
  return content;
};

/**
 * Main entry point
 */
export const main = async (): Promise<void> => {
  // Read input from stdin
  const chunks: Array<Buffer> = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const inputStr = Buffer.concat(chunks).toString("utf-8");

  // Parse input JSON
  let input: SessionEndInput;
  try {
    if (!inputStr.trim()) {
      // Empty stdin - exit silently
      process.exit(0);
    }
    input = JSON.parse(inputStr);
  } catch {
    // Invalid JSON - exit silently
    process.exit(0);
  }

  // Read transcript file
  let transcriptContent: string;
  try {
    transcriptContent = await readTranscript({
      transcriptPath: input.transcript_path,
    });
  } catch {
    // Can't read transcript - exit silently
    process.exit(0);
  }

  // Check for empty transcript
  if (!transcriptContent.trim()) {
    process.exit(0);
  }

  // Parse transcript
  const messages = parseTranscript({ content: transcriptContent });

  // Check if there are any user messages
  if (!hasUserMessages({ messages })) {
    process.exit(0);
  }

  // Count skill usage
  const skillUsage = countSkillUsage({ messages });

  // Check checklist compliance
  const checklistFollowed = wasTodoWriteUsed({ messages });

  // Format and output
  const outputMessage = formatOutput({ skillUsage, checklistFollowed });

  const output = {
    systemMessage: outputMessage + "\n\n",
  };

  console.log(JSON.stringify(output));
  process.exit(0);
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => {
    // Silent failure - hooks should not crash sessions
    process.exit(0);
  });
}
