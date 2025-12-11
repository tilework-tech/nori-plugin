---
description: How to invoke subagents via cursor-agent CLI for specialized tasks like web research and code analysis
alwaysApply: false
---

<required>
**CRITICAL**: Whenever you are using a rule, add the following to your Todo list using `todo_write`:

1. Look for the requested subagent in `{{subagents_dir}}/`
2. Call `cursor-agent` using the Bash tool in headless mode with the content of the subagent file and the user request.

```bash
cursor-agent -p "$(cat {{subagents_dir}}/nori-web-search-researcher.md)

---
USER REQUEST:
Research how to implement OAuth 2.0 PKCE flow in a Next.js application.
" --force
```

3. If the cursor-agent does not exist, or because the API key is not set, show an error to the user and instruct the user to setup cursor-agent.
4. Parse the subagent behavior and choose how to respond.
</required>


# Using Subagents in Cursor

Subagents are specialized AI assistants that can perform focused tasks. Unlike Claude Code which has a built-in Task tool, Cursor invokes subagents via the `cursor-agent` CLI in headless mode.

## How to Invoke a Subagent

Use the Bash tool to run `cursor-agent` in headless mode:

```bash
cursor-agent -p "Your prompt here" --force
```

### Flags:
- `-p` / `--print`: Non-interactive mode, prints response to console
- `--force`: Allows file modifications without confirmation (use with caution)
- `--output-format text`: Human-readable output (default)

### Example: Web Research

```bash
cursor-agent -p "Research the latest best practices for React Server Components in 2025. Focus on official documentation and recent blog posts." --force
```

### Example: With Subagent Prompt

To use a predefined subagent, pass its instructions as context:

```bash
cursor-agent -p "$(cat {{subagents_dir}}/nori-web-search-researcher.md)

---
USER REQUEST:
Research how to implement OAuth 2.0 PKCE flow in a Next.js application.
" --force
```

## Output Handling

The subagent's response will be printed to the terminal. You can:

1. **Read directly** - View the output in the terminal
2. **Parse programmatically** - Use `--output-format json` for structured output
3. **Redirect to file** - `cursor-agent -p "..." > output.txt`

## Troubleshooting

**"cursor-agent not found"**
- Install cursor-agent CLI: `curl https://cursor.com/install -fsSL | bash`

**"Authentication failed"**
- Set your API key: `export CURSOR_API_KEY="your-key"`

**"Rate limited"**
- Wait before making additional requests
