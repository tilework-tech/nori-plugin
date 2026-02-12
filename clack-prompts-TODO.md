# @clack/prompts Migration TODO

Remaining tasks for completing the migration to @clack/prompts.

See `src/cli/prompts/flows/clack-prompts-usage.md` for patterns and conventions.

---

## Remaining Command Migrations

- [ ] `login.ts` - Add experimentalUi routing to loginFlow
  - Flow exists at `flows/login.ts`
  - Need to wire up routing in command similar to init/switch

- [ ] `onboard.ts` - Full flow migration (most complex)
  - Multiple prompts: auth, profile selection, confirmation
  - Consider breaking into smaller flows or composing existing ones

- [ ] `watch.ts` - Replace `promptUser` with clack prompts
  - Simple text prompt, should be straightforward

---

## Cleanup

- [ ] Delete `src/cli/prompt.ts` after all commands migrated
  - Currently used by: login.ts, watch.ts, existingConfigCapture.ts (legacy paths)
  - Update any test mocks that reference it

- [ ] Remove legacy path from `existingConfigCapture.ts`
  - initFlow now handles config capture
  - Legacy function may still be called from non-experimentalUi paths

---

## Testing

- [ ] Cross-platform terminal testing (macOS + Linux)
- [ ] Verify non-interactive mode works for all migrated commands
