# SP-692: Document slash-commands V8 coverage strategy — Status

**Current Step:** Step 1 — Document strategy
**Status:** 🔄 In Progress
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
**Status:** 🔄 In Progress
- [ ] Docs contain strategy language
- [ ] Full suite (docs-only)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `#222` section in test-layout doc references stale module path `src/batch/slash-commands.ts` (no git history) and `tests/batch/run-metrics-usage-redaction.test.mjs` (absent). Canonical FR-SHIP-06 module is `extensions/spine/slash-commands.ts`. | Add dedicated FR-SHIP-06 section with canonical path + cross-link; do NOT rewrite the `#222` narrative (out of scope). Flag for operator to correct `#222` paths separately if desired. |
| `npm-publish.md` line 12 already points to `test-layout-coverage-notes.md` for coverage-gate guidance. | No change needed (Check If Affected → no-op). |

## Completion Criteria

- [ ] Strategy documented
- [ ] Post-mortem updated
- [ ] Isolation re-verify unchanged

## Blockers

_None yet._
