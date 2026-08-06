# SP-698: Matrix parent aggregation, #224 hook docs, supersede SP-690 — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** ✅ Complete
**Last Updated:** 2026-08-06
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-697 landed — first-class row lane scheduling in `matrix.mjs` (global `laneSlotPools` WeakMap, `acquireLaneSlot`/`releaseLaneSlot`) + `matrix-run.mjs` (`runMatrixTaskOnLane` rows acquire global pool slots); no `maxParallel - 1` nested throttle remnants in `src/`
- [x] Confirm runbook still has SP-690 interim language — yes: §2.4 concurrency bullet (`max(1, lanes.maxParallel - 1)` interim throttle), "Interim invariant" blockquote, "Planner packing (interim)" caveat; QUICK-REFERENCE matrix note "(capped to remaining lane slots, SP-690 / #227)"

---

### Step 1: Aggregation + docs superseding interim throttle
**Status:** ✅ Complete

- [x] All-rows-succeed parent policy confirmed — `aggregateMatrixOutcomes` fails closed (`ok` only when zero failed rows); `runMatrixTaskOnLane` marks parent failed with `matrix_sub_lane_failed:<rowIds>`; no code change needed
- [x] Fail-one-row regression confirmed — `aggregateMatrixOutcomes: any failure surfaces failing row ids` + `E2E: a failing row fails the whole matrix task and surfaces the row id` in `tests/batch/matrix-execution.test.mjs` (landed by SP-697 per amendment)
- [x] #224 hook confirmed — `runMatrixSubLane` calls `runMatrixSubLaneSetupHook` on every row worktree before runCommand/worker, fail-closed with `matrix.sub_lane.setup_hook.*` journal events; hook tests green in test file
- [x] Runbook §2.4 / QUICK-REFERENCE updated — first-class row lanes supersede SP-690 interim throttle (concurrency bullet, blockquote, planner-packing caveat, QUICK-REFERENCE matrix note); deferred #229–#232 documented

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Fail-one-row aggregation test green
- [x] Contract `testCommand` green — typecheck EXIT 0; scoped matrix-execution 28/28
- [x] FULL suite green — `SPINE_WORKER_STUB=1 npm test` → 2360/2360 (EXIT 0; `/tmp/pi-spine-sp698-full.exit`)
- [x] Coverage gate — in-scope line **88.93%** (≥77%); `/tmp/pi-spine-sp698-coverage.log`. During coverage under live attached batch `20260806T175646`, `attached-batch-exit` + `detached-start` timed out once; re-ran those suites in isolation → **17/17 pass** (EXIT 0; `/tmp/pi-spine-sp698-lifecycle-flaky.exit`). Operator-assist recovery (same path as SP-695/SP-697).

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Docs complete — runbook §2.4 + QUICK-REFERENCE supersede SP-690 (commit `c2f98968`)
- [x] `.DONE` created

---

## Blockers

None — SP-697 landed (git log `46dee11d` / `fb44c6bf`).

## Notes

Closes #228 together with SP-697.

**2026-08-06:** Pre-landed amend — `fileScopeMustChange` redirected to `docs/QUICK-REFERENCE.md` after SP-697/SP-695 touched shared matrix tests and runbook.

**2026-08-06 (Step 0/1 findings):** All code completion criteria were already satisfied by SP-697's land (aggregation fail-closed, fail-one-row regressions, #224 hook per row). SP-698's remaining delivery is docs-only: rewrite runbook §2.4 + QUICK-REFERENCE matrix note to supersede the SP-690 nested throttle and document deferred #229–#232 (env, status APIs, maxFailedIndexes, full PROMPT subst).

**2026-08-06 (operator-assist):** Worker idle mid–Step 2 with no test children; operator ran FULL suite + coverage on lane, then STATUS + `.DONE`.
