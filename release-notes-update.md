---
name: Release Notes Update
description: Step-by-step instructions for updating release-notes.txt before npm publish
---

<required>
*CRITICAL* Follow these steps exactly in order:

1. Find the last version commit using git log.

Run the following command to find the most recent version commit:
```bash
git log --oneline --grep="^v[0-9]" -1 --format="%H %s"
```

This finds commits with messages starting with "v" followed by a number (e.g., "v19.1.1").

2. Get all commits since the last version.

Using the commit hash from step 1, run:
```bash
git log --oneline <commit_hash>..HEAD
```

If there are no commits since the last version (empty output), skip to step 6.

3. Read the current release-notes.txt file.

Read the existing release notes to understand the format and append new notes.

4. Categorize the commits and draft release notes.

Group commits into categories:
- **Features**: Commits starting with "feat:" or containing "Add", "Implement"
- **Fixes**: Commits starting with "fix:" or containing "Fix", "Resolve"
- **Documentation**: Commits starting with "docs:" or containing documentation changes
- **Other**: Any remaining commits

Format the new release notes section as:
```
## vX.X.X (YYYY-MM-DD)

### Features
- Description of feature (commit hash)

### Fixes
- Description of fix (commit hash)

### Other
- Description of change (commit hash)
```

Use the version from package.json for the version number.
Use today's date for the release date.

5. Update release-notes.txt with the new section.

Prepend the new release notes section to the top of release-notes.txt, below the header.

6. Stage the updated release-notes.txt file.

Run:
```bash
git add release-notes.txt
```

This ensures the release notes are included in the publish commit.

</required>

# Additional Guidelines

## Version Detection

The version pattern in this repository is `vX.X.X (#NNN)` in commit messages, where:
- `X.X.X` is the semantic version
- `#NNN` is the PR number

Example: `v19.1.1 (#203)`

## Empty Releases

If there are no commits since the last version, the release notes should not be updated. This can happen if you're re-publishing the same version.

## Commit Message Conventions

This project follows conventional commits loosely:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `bump` - Version bumps (ignore these in release notes)

## Error Handling

If git commands fail or produce unexpected output, report the error and stop. Do not generate placeholder or fake release notes.
