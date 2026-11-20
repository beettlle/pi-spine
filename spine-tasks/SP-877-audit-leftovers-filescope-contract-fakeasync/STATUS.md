# SP-877: Audit leftovers: fileScope fallback, contract.errors, fake-async bin guard — Status

**Current Step:** Complete
**Status:** ✅ Complete — awaiting engine plan/final review
**Last Updated:** 2026-11-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm three leftover sites
- [x] Read fake-async guard scope

---

### Step 1: Three leftovers
**Status:** ✅ Complete

- [x] Validate fileScope env JSON
- [x] Surface contract.errors
- [x] Fix runSpinePlan + extend guard

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Cover each leftover path

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract testCommand
- [x] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries in STATUS
- [x] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand failed (exit 1): fd5fa24  bin/spine-worker-runner.mjs:303  WARNING  The new strict validation throws an Error when SPINE_TASK_FILE_SCOPE is set bu | advisory — noted, not blocking | contract review step |
| Making `runSpinePlan` sync breaks `assert.doesNotReject` in `tests/planner/plan-pending-empty.test.mjs` (out of File Scope) | Used mission's "or truly async" branch: real `await` on `fs.promises` artifact write in `bin/spine-plan.mjs`; out-of-scope test files untouched | `bin/spine-plan.mjs` |
| `extractBracedBody` in the fake-async guard grabbed destructured parameter `{` instead of the body brace, misclassifying genuinely-async functions with destructured params (e.g. `buildWorkerPiArgs`) as fake-async once `bin/` was swept | Fixed extractor to skip the parameter list first; backward compatible for non-destructured signatures | `tests/arch/fake-async.test.mjs` |
| Contract testCommand's `phase23-exit-verify` enforces src/batch ≤500 LOC (grandfather list empty); the SP-877 guard pushed `worker-host.mjs` to 535 | Added `failPreflight` literal-builder and let the three adjacent preflight guards (`review_failed`, `contract_parse_failed`, `launch_failed`) share it — behavior-neutral, file back to 499 LOC | `src/batch/worker-host.mjs` |
| `tests/batch/heartbeat.test.mjs` fails only when run inside a worker session (`SPINE_IS_WORKER=1` blocks the in-process nested `startBatch`) | Environmental, per PROMPT Environment note; passes with `SPINE_IS_WORKER` unset (exit 0 verified) | n/a |
| Runbook check (`docs/adoption/operator-runbook.md`): metrics / plan-review sections unaffected by this change; the worker-failure narrative (`launch_failed` at L2009) could later mention `contract_parse_failed`, but `docs/` is outside File Scope — left for a follow-up docs task | Checked, no edit (scope) | n/a |
| Full `scripts/worker-verify.sh` (typecheck + entire stub suite) exits 0 with `SPINE_IS_WORKER` unset | Verified in-session, foreground | n/a |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-19 | Step 1 committed (fb8ff6be) | fileScope validation, contract_parse_failed surfacing, runSpinePlan async write, bin/ guard sweep |
| 2026-11-20 | Step 2 committed (4b69b8b0) | worker-host-contract.test.mjs: 8 tests covering all three leftover paths |
| 2026-11-20 | Step 3 verified | Contract testCommand exits 0 (lint + typecheck + 4 test files); detect_changes low risk; 7-suite runWorker regression sweep exits 0 |
| 2026-11-20 | Step 3 committed (d4031790) | failPreflight consolidation under 500-LOC policy |
| 2026-11-20 | Step 4: worker-verify exit 0 | Full stub suite fail 0; STATUS complete; .DONE created |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
