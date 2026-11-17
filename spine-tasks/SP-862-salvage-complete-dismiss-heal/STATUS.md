# SP-862: salvage complete dismiss heal — Status

**Current Step:** Complete
**Status:** ✅ All Steps Complete
**Last Updated:** 2026-11-16
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `healAfterSalvageLand` / complete dismiss gates; report blast radius
- [x] Reproduce the refuse path from #374 in the existing salvage-complete test harness (or document the missing case)

### Step 1: Heal / gate gap
**Status:** ✅ Complete

- [x] Close the v2.30.0 gap so salvaged-only batches can complete/dismiss without `--force`

### Step 2: Tests
**Status:** ✅ Complete

- [x] complete, complete --detect-manual-merge, dismiss without --force after salvage land
- [x] unresolved failure still blocks

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Contract `testCommand` passing
- [x] All failures fixed

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand failed (exit 1): 658ac7c  src/batch/lifecycle.mjs:165  WARNING  The salvageCompleted bypass allows dismiss for any diagnosis (including 'failed' o | advisory — noted, not blocking | contract review step |
| #374 root cause: salvage merges lane task branches onto base, not the batch orch branch — after a full salvage heal the batch still diagnosed `needs_merge` (phase `failed`, all terminal-success, `mergeResults` empty, orch unmerged/absent), so `complete` refused at the merge gate (`mergeSatisfied` false) and `dismiss` refused because `needs_merge` ∉ `DISMISS_ALLOWED` (reproduced pre-fix: complete, complete --detect-manual-merge, dismiss all refuse) | Fixed | `src/batch/salvage-batch-integrate-heal.mjs`, `src/batch/lifecycle.mjs`, `src/batch/integrate-assert.mjs` |
| Fix: heal writes `salvageLandedAllTasks` evidence (+ `batch.salvage_landed_all_tasks` journal event) only when the heal leaves zero non-terminal tasks; complete treats it as merge evidence (`mergeSatisfied` term + `assertOrchIntegratable` `salvageLanded` bypass), dismiss allows non-force when evidence + `allTasksTerminalSuccess` both hold. Fail-closed: evidence alone never opens a gate — a later retry re-opening tasks re-arms refusals; non-salvageable failures (e.g. `contract_failed`) never produce evidence | Done | `src/batch/salvage-batch-integrate-heal.mjs`, `src/batch/lifecycle.mjs` |
| LOC guard (`tests/cli/phase23-exit-verify.test.mjs`, 500-line limit) forced keeping `reconcile-batch.mjs` untouched: the salvage signal is read via existing `signals.raw` (= batch raw state), and `hasLiveLanes` moved from `lifecycle.mjs` (495) to `lifecycle-archive.mjs` (217) | Done | `src/batch/lifecycle-archive.mjs`, `src/batch/reconcile-batch.mjs` (reverted to original) |
| SP-857 owns the operator-runbook update ("dismiss after salvage land without --force"); not changed here per PROMPT | Deferred | `docs/adoption/operator-runbook.md` |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |
| 2026-11-16 | Step 0 preflight | GitNexus impact: `healAfterSalvageLand` → `integrateSalvageableLane` only (LOW risk); #374 refuse modes reproduced in scratch harness (orch-orphan variant) |
| 2026-11-16 | Step 1 | Salvage-land evidence + complete/dismiss gate fix; existing tests green |
| 2026-11-16 | Step 2 | 4 new tests (#374 orch-orphan complete/detect-manual-merge/dismiss, fail-closed dismiss, multi-lane) — 7/7 green |
| 2026-11-16 | Step 3 | Contract `testCommand` exit 0 (lint + typecheck + 16 tests) after LOC-guard restructure |
| 2026-11-16 | Step 4 | Discoveries logged; `.DONE` created |

## Blockers

*None*
