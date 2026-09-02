# SP-740: Gate reopen for completed phase + runbook §5.2 — Status

**Current Step:** 1 — Re-open path for completed
**Status:** 🟣 Step 0 complete; plan ready for review
**Last Updated:** 2026-09-02
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-739 `.DONE` on main — `spine-tasks/SP-739-salvage-integrate-open-gate/.DONE` exists on origin/main; commit `8a4764cb` is ancestor
- [x] Map stale_revision → delete gate → resume refuse completed — `checkIntegrateGate` (gate.mjs) emits `stale_revision` + "re-open and re-approve"; runbook §5.2 says delete `gate.json` then `spine batch resume --force`; `validateMultiTaskResume` (resume-multi-validate.mjs) never admits `phase === "completed"` in `resumable` → `cannot_resume` "Cannot resume batch in phase completed." → dead end (#275)

#### Implementation plan (Review Level 2)

1. **gate.mjs** — add `reopenIntegrateGateForCompletedBatch({ projectRoot, batchId, batchState? })`:
   - Fail closed unless `batchState.phase === "completed"` (load state when not passed).
   - Existing gate + `status approved` + `validateGateTargetRevision` ok → `{ reopened:false, reason:"gate_current" }` (never silently invalidate a current approval).
   - Existing gate + `status pending` + pin ok → `{ reopened:false, reason:"gate_pending" }`.
   - Gate missing / pin stale / `rejected` → remove stale `gate.json` (fs rm), journal `gate.reopened`, then route through `openIntegrateGateAfterBatchComplete` → fresh pin (current orch tip) + fresh evidence, status `pending`.
   - `getIntegrateGateStatus`: when no gate and batch phase `completed` → suggestedCommand `spine gate reopen` (align with integrate).
   - `checkIntegrateGate` missing_gate branch: headline/suggestedCommand mention `spine gate reopen` for completed batches. `ok/exitCode/blockers` unchanged (impact HIGH — display-only change in that branch).
2. **bin/spine-gate.mjs** — add `reopen` action → human/JSON output via existing `formatGateHuman`.
3. **resume-multi-validate.mjs** (must-change) — admit `phase === "completed"`:
   - `!force` → refuse with guidance to `spine gate reopen` / `resume --force`.
   - `force` + pending tasks → refuse (use retry).
   - `force` + no pending tasks → `{ ok:true, gateReopen:true, ... }` (skip worktree checks; no worker re-run).
4. **resume.mjs** — in `resumeBatch`, right after `validateResumeBatch`, if `resumeCheck.gateReopen` → call `reopenIntegrateGateForCompletedBatch`, release lock, return its result (before the multi-task branch, so no waves re-run).
5. **Runbook §5.2** — recovery steps become `spine gate reopen` (or `resume --force` for completed); drop hand-delete gate.json + refused resume path.
6. **Tests** — gate-target-revision-validate.test.mjs: reopen re-pins after drift; reopen fails closed when gate current; reopen on non-completed refuses. gate.test.mjs: status/integrate message agreement when gate absent. resume-gate-open.test.mjs: regression — completed + no gate → `resumeBatch({force:true})` reopens gate, phase stays completed, no worker re-run.

---

### Step 1: Re-open path for completed
**Status:** ✅ Complete

- [x] Allow force-resume or dedicated `spine gate reopen` for completed + missing/stale gate — both: `spine gate reopen` action (bin/spine-gate.mjs) + `reopenIntegrateGateForCompletedBatch` (gate.mjs); `resume --force` on completed admitted via `gateReopen` flag (resume-multi-validate.mjs), routed in `resumeBatch` before the multi-task branch (resume.mjs)
- [x] Re-pin targetRevision to current orch tip and re-collect evidence — reopen removes stale/decided record, journals `gate.reopened`, routes through `openIntegrateGateAfterBatchComplete`; approved/pending gates with a current pin fail closed (`gate_current` / `gate_pending`, never invalidated)
- [x] Make integrate / gate status messages agree when gate absent — completed batch: both suggest `spine gate reopen`; non-completed keeps prior text. Blocker code `missing_gate`, `exitCode: 2`, `failureClass` unchanged (impact HIGH — display-only in that branch)

---

### Step 2: Runbook §5.2 + tests
**Status:** ✅ Complete

- [x] Rewrite §5.2 recovery steps to the working path — `spine gate reopen` / `resume --force` (completed) replace hand-delete + refused resume; noted `gate_current`/`gate_pending` fail-closed guard and the pre-#275 wedge; `missing_gate` table row and land-loop stale-revision cross-reference now name the command
- [x] Regression: completed + no gate → reopen succeeds — 3 new cases in resume-gate-open.test.mjs (no gate / drifted pin / non-force guidance), 5 reopen unit cases in gate-target-revision-validate.test.mjs, 4 status/integrate-agreement + CLI cases in gate.test.mjs; all pass

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint — `npm run lint` exit 0, no warnings
- [x] Run Contract testCommand — `SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/resume-gate-open.test.mjs tests/batch/gate-target-revision-validate.test.mjs tests/batch/gate.test.mjs tests/batch/detached-resume-gate.test.mjs` → 31/31 pass
- [x] Fix all failures — none in contract; `npm run typecheck` also clean. Safety net over 11 adjacent suites (resume validation, merge-blocked, meta-reconstruct, orphan recovery, detached wait, post-merge limbo, evidence gate): 52/53, the 1 failure is `startBatch` nested-spawn guard — reproduced with `SPINE_IS_WORKER` unset (6/6 pass) vs set (guard fires); environmental SP-482 worker constraint, not a regression

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Docs updates — `docs/adoption/operator-runbook.md` §5.2 rewritten to `spine gate reopen` / `resume --force` working path (done in Step 2, Documentation Requirements met)
- [ ] Create `.DONE` — after final completion-criteria sweep below
