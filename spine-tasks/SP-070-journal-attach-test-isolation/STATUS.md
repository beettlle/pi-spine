# SP-070: Journal attach test isolation — Status

**Current Step:** Done
**Status:** ✅ Complete
**Last Updated:** 2026-06-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Reproduce pollution: `SPINE_JOURNAL_ATTACH=1` + `npm test` writes review events to live batch journal
- [x] List P0/P1 fix targets from conversation root-cause analysis

---

### Step 1: Attach gate design
**Status:** ✅ Complete

- [x] **P0-B:** Add `isJournalAttachBlocked()` — honor `SPINE_SUPPRESS_JOURNAL_ATTACH=1` and `npm_lifecycle_event === "test"`
- [x] **P0-C:** Gate env-derived progress writes through `resolveBatchJournalContext()` (CLI + Pi tool)
- [x] **P0-A:** Set suppress in `package.json` test script; add `scripts/worker-verify.sh`; document in worker template
- [x] **P1:** Decouple `SPINE_REVIEW_STUB_FAIL` from `useStub` unless stub mode is explicitly active

---

### Step 2: Implement P0/P1 fixes
**Status:** ✅ Complete

- [x] Harden `resolveBatchJournalContext()` with attach block checks
- [x] Update `runSpineReportProgress` and `executeSpineReportProgress` to require attach context (no raw `SPINE_BATCH_ID` fallback)
- [x] Fix stub fail env coupling in `runStepReview`
- [x] Add `scripts/worker-verify.sh`; set `SPINE_SUPPRESS_JOURNAL_ATTACH=1` in npm `test` script
- [x] Update `templates/agents/worker.md` verification guidance

---

### Step 3: Tests + verification
**Status:** ✅ Complete

- [x] Regression tests: attach env + suppress → no journal writes for review/progress
- [x] Fix review CLI/tool tests to pass explicit `journal` or set stub env consistently
- [x] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `runSpineReportProgress` used raw `SPINE_BATCH_ID` without attach gate | Fixed in Step 2 | `bin/spine-report-progress.mjs` |
| `executeSpineReportProgress` same bypass | Fixed in Step 2 | `extensions/spine/worker-tools.ts` |
| `SPINE_REVIEW_STUB_FAIL=1` alone triggered stub fail path | Fixed in Step 2 | `src/batch/review.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-03 | Task staged + implementation started | PROMPT.md, STATUS.md created; P0/P1 code in flight |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
