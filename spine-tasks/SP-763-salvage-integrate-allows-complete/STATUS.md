# SP-763: After salvage integrate allow batch complete — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🟣 Step 2 complete
**Last Updated:** 2026-09-22
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm complete refuses after salvage integrate
- [x] Dependencies satisfied (SP-762)

### Step 1: Heal complete after salvage land
**Status:** ✅ Complete

- [x] Complete no longer refused solely on salvaged prior failure
- [x] Still refuse other unresolved failures
- [x] Test salvage→complete path

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint
- [x] Run Contract testCommand
- [x] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create .DONE

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| SP-762 merged on lane (commit 596390d8, #291) — dependency satisfied | closed | git log |
| Failure bits after salvage integrate: task `status:"failed"` → `terminal-failure` classification, failed segment (classification derived from status in parseBatchState), `failedTasks>0` counter → `hasFailedTasks` → `needs_retry` → complete refused | root cause | `src/batch/reconcile-batch.mjs`, `src/batch/reconcile-classify.mjs` |
| Heal must cover task status, segments (`updateSegmentForTask`), and counters (`recomputeTaskCounters`) — `recordTaskSucceeded` does all three | design | `src/batch/state.mjs` |
| SP-762's post-DONE reclassification surfaces `pending_lane_land` (not `needs_retry`) for plan-review spawn failures — healing status to succeeded removes the task from that path too (requires status failed) | discovery | `src/batch/reconcile-diagnosis.mjs` |
| When orch has commits not on base (earlier waves merged to orch), salvage of a later lane leaves `orchMergedToBase` false → complete still refuses (`needs_integrate`) — correct, not a sole prior-failure refusal | discovery | reconcile-diagnosis branch order |
| Healed status is drift-safe: last journal lifecycle event becomes `task.completed` (cached succeeded) → no `state_drift` entry in `detectBatchStateDrift` | design | `src/batch/journal-rebuild-drift.mjs` |
| `batch-loc-policy` caps `src/batch/**` at 500 LOC ungrandfathered; salvage-batch-integrate.mjs already 472 → heal goes in new `salvage-batch-integrate-heal.mjs` (pattern: `salvage-batch-integrate-gate.mjs`) | constraint | `bin/spine-cli/verify.mjs` |
| Post-heal complete path: `allTasksTerminalSuccess` + `orchMergedToBase` (salvage merge makes orch ancestor of main) → `mergeSatisfied` → allowed; `assertOrchIntegratable` ok; `.DONE` on main → no `pending_lane_land` | design | `src/batch/lifecycle.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-21 | Task staged | PROMPT.md and STATUS.md created for v2.22.0 |
| 2026-09-22 | Step 0 preflight | Traced #292 path; SP-762 verified merged; wrote failing-first test `tests/batch/salvage-complete-after-integrate.test.mjs`; pre-fix run confirms complete refusal after salvage integrate (see Notes) |
| 2026-09-22 | Step 1 implemented | `salvage-batch-integrate-heal.mjs` (heal + journaling, 117 LOC); wired into both `alreadyMerged` and post-merge paths of `integrateSalvageableLane`; result/formatter surface `healedTaskIds`/`healError`; new test 3/3 green |
| 2026-09-22 | Step 1 regression check | 9 related salvage/lifecycle suites: 56/58 pass; only failure is pre-existing on lane baseline (verified via `git stash` A/B): `salvage-inspect.test.mjs` "startBatch worker failure with dirty scoped file…" |
| 2026-09-22 | Step 2 verification | Contract testCommand green in foreground: `npm run lint` clean (--max-warnings 0), `npm run typecheck` clean (both tsconfig projects), contract test 3/3 pass; `batch-loc-policy` 0 over-limit modules |

---

## Blockers

*None*

---

## Notes

**Plan (Review Level 1, before Step 1 coding):**

- New module `src/batch/salvage-batch-integrate-heal.mjs` exporting `healSalvagedTasksAfterIntegrate(projectRoot, batchId, { salvageableTasks, mergeCommit })`:
  - Loads active batch state (`loadBatchStateFile`); no-op returns when no active state, batchId mismatch, or no salvageable tasks (salvage also runs against archived batches where `complete` is not applicable).
  - Per salvageable task not already terminal-success: `recordTaskSucceeded(state, taskId, { exitReason: "done", doneFileFound: true })` — heals task status, segments, and counters atomically; journals `task.completed { reconciled: true, reconcileReason: "salvage_integrated" }` so journal rebuilds agree (same promotion as `reconcileBatchStateDrift`).
  - Persists once via `saveSpineBatchState` (batch-state-lock protected, re-entrant).
- Wire into `integrateSalvageableLane` after successful merge + sync: heal failure never fails the integrate (merge already landed) — surfaced via `healedTaskIds` / `healError` on the result, `batch.salvage_integrated` payload, and formatter output.
- `completeBatch` itself needs no change: healing makes `allTasksTerminalSuccess` true and `mergeSatisfied` true (orch ancestor of main), which satisfies the existing `allowed` gate; unresolved failures still classify `terminal-failure` and refuse.

**Step 0 evidence (pre-fix run of new test):**

- `SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/salvage-complete-after-integrate.test.mjs`
- Happy-path test fails at the post-integrate `completeBatch` assertion: `ok: false`, headline `needs_retry — complete refused` while failed-task bits remain — the #292 refusal reproduced in fixtures (preflight ✔).
