---
name: Recall
description: Search the Nori knowledge base for relevant context, solutions, and documentation.
---

# Recall

Searches the shared knowledge base for relevant context or fetches specific artifacts by ID.

## When to Use

**Search mode** - Search for:

- Previous solutions and debugging sessions
- User-provided docs and project context
- Code patterns and architectural decisions
- Bug reports and conventions

**Fetch mode** - Retrieve full artifact when:

- You have an artifact ID from search results
- You need complete artifact content (not just snippets)
- You want to dig deeper into a specific result

Skip recall when:

- You need current file contents (use Read tool)
- Information is in recent conversation history
- Searching for generic programming knowledge

## Usage

### Search Mode

```bash
node {{skills_dir}}/recall/script.js --query="Your search query" --limit=10
```

### Fetch Mode

```bash
node {{skills_dir}}/recall/script.js --id="artifact_id"
```

## Parameters

- `--query` (mutually exclusive with `--id`): Describe what you're trying to do or problem you're solving
- `--id` (mutually exclusive with `--query`): Fetch a specific artifact by ID
- `--limit` (optional, search mode only): Maximum results (default: 10)

## Examples

### Search for artifacts

```bash
node {{skills_dir}}/recall/script.js --query="implementing authentication endpoints" --limit=5
```

### Fetch specific artifact

```bash
node {{skills_dir}}/recall/script.js --id="nori_abc123def456"
```

## Output

**Search mode**: Returns artifact snippets (truncated to 200 chars) with metadata and search source breakdown (keyword, fuzzy, vector).

**Fetch mode**: Returns complete artifact content without truncation, including full metadata (name, ID, type, repository, timestamps).

## Requirements

- Paid Nori subscription
- Configured credentials in `~/nori-config.json`
