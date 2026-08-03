# SP-694: Guard TEST_GLOBS covers every tests suite directory — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🔄 In Progress
**Last Updated:** 2026-08-02
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Done
- [x] Confirm parity gap
- [x] Map suite dirs to TEST_GLOBS

### Step 1: Suite-directory discovery guard
**Status:** ✅ Done
- [x] Allow-list constant if needed
- [x] Discovery guard test(s)
- [x] Document allow-list
- [x] Keep existing parity green

### Step 2: Testing & Verification
**Status:** ✅ Done
- [x] Scoped contract testCommand
- [x] Fix failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Plan (Step 1) — Review Level 1

1. Add `SUITE_DIR_ALLOWLIST` constant to `scripts/coverage-policy.mjs` (next to
   `TEST_GLOBS`) listing the 6 pre-existing intentional exclusions
   (`arch`, `fixtures`, `fs`, `helpers`, `scripts`, `util`), each with a brief
   reason + header comment describing the allow-list mechanism (#246 / §F5).
2. Add a discovery guard test in `tests/coverage/policy.test.mjs` that scans
   `tests/*/` for non-empty suite dirs (contain `*.test.mjs`) and fails when any
   is absent from `TEST_GLOBS` **and** absent from `SUITE_DIR_ALLOWLIST`.
3. Add a companion assertion that every allow-listed dir actually exists and has
   tests (keeps the allow-list honest — no stale cruft).
4. Import `readdirSync` in the test file.
5. Do NOT touch `package.json` (out of file scope); existing bidirectional
   parity stays as-is.

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| 6 suite dirs (`arch`, `fixtures`, `fs`, `helpers`, `scripts`, `util`) contain `*.test.mjs` but are absent from `TEST_GLOBS`/`package.json test` | Allow-list them as pre-existing intentional exclusions (no npm script runs them; wiring into `npm test` is out of file scope — separate task) |
| `tests/config/cursor-rules/` is a nested dir covered by `tests/config/cursor-rules/*.test.mjs` | Guard scans `tests/*/` direct children only, so nested dirs don't false-trigger |
| Real-pi session (`SPINE_IS_WORKER=1`, runner set, not stub) | Skip in-worker `spine_review_step` (returns skipped); batch engine reviews after `.DONE` |

## Completion Criteria

- [x] Suite-dir omission fails tests — proven via probe dir (exit 1, "Unaccounted: tests/__sp694_probe")
- [x] Allow-list documented if used — header comment + per-entry reasons in SUITE_DIR_ALLOWLIST
- [x] Parity still green — all 13 policy.test.mjs tests pass; typecheck + lint clean

## Blockers

_None yet._
