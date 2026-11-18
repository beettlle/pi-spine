# SP-869: Validate --batch IDs at CLI entry points; sanitize review baseline — Status

**Current Step:** Step 2 — Tests
**Status:** 🟡 In Progress (Step 2)
**Last Updated:** 2026-11-18
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] `rg -n "--batch|validateBatchId" bin/ src/cli/ src/batch/` — list entry points missing validation
  - **Unvalidated `--batch` argv readers (fixed in Step 1):** `bin/spine-gate.mjs`, `bin/spine-integrate.mjs`, `bin/spine-batch.mjs` (`parseBatchArgs`), `bin/spine-journal.mjs` (replay + export), `bin/spine-state.mjs`, `src/cli/handoff.mjs`.
  - **Already validated (no change needed):** `src/cli/journal-follow.mjs` + `src/cli/lane-logs.mjs` (both route through `resolveFollowBatchId` → `validateBatchId`, covered by existing tests in `tests/batch/batch-id-validation.test.mjs`).
  - **Baseline:** engine code-review path is already SHA-gated (`isValidCommitSha` in `src/batch/contract-task-start.mjs`, #343; `review-code.mjs:119`). Unvalidated sink: `bin/spine-review-step.mjs --baseline` (raw) → `buildReviewRequest` prompt interpolation + `resolveCodeReviewScopePaths` git argv; also `src/cli/rules.mjs --baseline` → `resolveReviewScopePaths`.
- [x] GitNexus impact on `validateBatchId` / review baseline; report in STATUS
  - **GitNexus impact result: UNKNOWN** — `impact` returned "Target 'validateBatchId' not found"; this lane worktree has no `.gitnexus/` and the task forbids modifying `.gitnexus/`, so the index could not be consulted. Per AGENTS.md, UNKNOWN is treated as unresolved and confirmed by exhaustive text search instead: `validateBatchId` callers = `src/cli/journal-follow.mjs` (resolveFollowBatchId) and `src/batch/state.mjs` (re-export only); `resolveCodeReviewScopePaths` callers = `resolveReviewScopePaths` (review-scope.mjs) and tests; `buildReviewRequest` caller = `src/batch/review-step-run.mjs`; `resolveReviewScopePaths` callers = `src/batch/review-step.mjs` + `src/cli/rules.mjs`.

---

### Step 1: Validate --batch + baseline
**Status:** ✅ Complete

- [x] Wire `validateBatchId` at all CLI `--batch` readers listed in Mission
  - `bin/spine-gate.mjs` — `resolveActiveBatchId` validates; throw → structured result (exit 2, human + `--json`).
  - `bin/spine-integrate.mjs` — validates before `integrateOrchToBase` (exit 2 + usage).
  - `bin/spine-batch.mjs` — `runSpineBatch` validates `parsed.batchId` after parse (exit 1).
  - `bin/spine-journal.mjs` — `runJournalReplay` + `runJournalExport` validate (exit 1 + usage).
  - `bin/spine-state.mjs` — validates before `resolveBatchStateFileForValidation` (exit 1, human `❌` + `--json`).
  - `src/cli/handoff.mjs` — `runSpineHandoff` validates before `assembleHandoffData` (exit 1).
  - `spine metrics show` (`bin/spine.mjs`) and `lane logs` (`src/cli/lane-logs.mjs`) are **out of File Scope**; lane-logs already validates via `resolveFollowBatchId`; metrics `batchId` is a JSONL line-equality filter only (no path join) — see Discoveries.
- [x] Add baseline allowlist helper; use in review-step / review-scope before git/prompt
  - `src/batch/batch-id.mjs`: `REVIEW_BASELINE_PATTERN`, `reviewBaselineRejectionReason`, `validateReviewBaseline` (first char alphanumeric → rejects `-` options and absolute paths; rejects whitespace/newlines, `..` traversal, metacharacters; allows full/short SHA + plain refs incl. `origin/main`).
  - `src/batch/review-scope.mjs`: `resolveCodeReviewScopePaths` validates before git argv (throws → fails the review step closed, no silent fallback).
  - `src/batch/review-step.mjs`: `buildReviewRequest` validates before prompt interpolation.

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Malicious `--batch` rejected
- [ ] Malicious baseline rejected; safe SHA still works

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-869-batch-id-baseline-validate/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
