# Paid Skills Bundler

**IMPORTANT**: This script bundles paid skill scripts into standalone executables.

## Why Bundling is Necessary

Paid skill scripts are TypeScript files that use:

- Path aliases (`@/api/index.js`, `@/cli/config.js`)
- External dependencies (`minimist`)
- Internal modules from the plugin package

After TypeScript compilation, `tsc-alias` converts `@` imports to relative paths like `../../../../../api/index.js`. When these scripts are installed to `~/.claude/skills/`, those relative paths no longer resolve correctly.

## Solution: esbuild Bundling

This script uses esbuild to create standalone bundles that:

- Inline all dependencies (minimist, API client, config utilities)
- Resolve all imports at build time
- Produce single-file executables that work from any location
- Preserve the shebang (`#!/usr/bin/env node`) for direct execution

## ESM/CommonJS Compatibility

### The Problem

When esbuild bundles CommonJS libraries into ESM format, dynamic `require()` calls for Node.js builtins fail at runtime with:

```
Error: Dynamic require of 'util' is not supported
```

This occurs because:
1. Scripts are bundled as ESM (`format: "esm"`)
2. Some dependencies are CommonJS libraries that use dynamic `require()`
3. ESM doesn't have a native `require` function

**Affected dependency chain**: Winston logger -> logform -> @colors/colors -> `require('util')`

### The Solution

The bundler injects `createRequire` from Node.js 'module' package via esbuild's `banner` option:

```javascript
banner: {
  js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
},
```

This provides a working `require` function in ESM context, allowing bundled CommonJS code to execute their dynamic require() calls for Node.js builtins.

## Build Process Integration

1. TypeScript compiles `src/` to `build/` (with `@` aliases)
2. `tsc-alias` converts `@` imports to relative paths
3. **THIS SCRIPT** bundles each `paid-*/script.js` (found in profile directories) into standalone version
4. Installation copies bundled scripts to `~/.claude/skills/`

## Output Structure

Skills are now inlined directly in profile directories (no mixin composition):

- **Input**: `build/src/cli/features/claude-code/profiles/config/*/skills/paid-*/script.js`
- **Output**: Same path (replaced with bundle)

The bundled version **REPLACES** the tsc output, so the installer workflow remains unchanged.

## Maintenance Notes

- **Add new paid skills**: They'll be auto-detected and bundled (any `paid-*/script.js` in any profile's skills/)
- **Update dependencies**: Rebuild will include updated versions
- **Debug bundling issues**: Run `npm run build` and check this script's output
- **Bundle size**: Each script is approximately 50-100KB (includes all dependencies)

## Integration Points

- `package.json:build` - Build pipeline integration
- `src/cli/features/claude-code/profiles/skills/loader.ts` - Installation process
- Profile skill directories contain paid skills like `paid-recall/script.ts`, `paid-memorize/script.ts`
