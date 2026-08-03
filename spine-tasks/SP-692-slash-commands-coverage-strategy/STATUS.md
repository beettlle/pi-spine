# SP-692: Document slash-commands V8 coverage strategy — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-08-02
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm isolation re-verify present
- [x] Note F6 coverage figures

### Step 1: Document strategy
**Status:** ✅ Complete
- [x] Expand test-layout-coverage-notes.md
- [x] Update post-mortem §F6 / backlog
- [x] Cross-links

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Docs contain strategy language (docs-only contract `testCommand: true`)
- [x] Grep both File Scope docs for `#245` and `isolation re-verify`
- [x] Did not run full `npm test` / `coverage:check` in the lane

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `#222` section in test-layout doc references stale module path `src/batch/slash-commands.ts` (no git history) and `tests/batch/run-metrics-usage-redaction.test.mjs` (absent). Canonical FR-SHIP-06 module is `extensions/spine/slash-commands.ts`. | Add dedicated FR-SHIP-06 section with canonical path + cross-link; do NOT rewrite the `#222` narrative (out of scope). Flag for operator to correct `#222` paths separately if desired. |
| `npm-publish.md` line 12 already points to `test-layout-coverage-notes.md` for coverage-gate guidance. | No change needed (Check If Affected → no-op). |
| Worker exited twice without `.DONE` (`worker_done_missing`) after Step 1 docs were already committed. | Operator completed Steps 2–3 and wrote `.DONE` in-lane to unblock wave-0 land. |

## Completion Criteria

- [x] Strategy documented
- [x] Post-mortem updated
- [x] Isolation re-verify unchanged

## Blockers

_None._
