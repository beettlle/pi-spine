# Reconciliation v1.8.1 — Explore Findings (SP-511)

**Created:** 2026-07-07  
**Author:** SP-511 worker  
**Source PRD:** [`docs/PRD-v1.8.1-reconciliation-handoff.md`](../../../docs/PRD-v1.8.1-reconciliation-handoff.md)  
**Satisfies:** PRD §12.1 optional explore (`spine batch start SP-511`)

---

## Executive summary

Two release batches (`20260705T210857`, `20260706T052912`) stall when **lane on-disk truth** (`.DONE`, review APPROVE, contract verify) disagrees with **batch-state cache** (`status: running`). Diagnosis surfaces `state_drift` or `engine_orphaned`, macro phase reports `Failed`, and `suggestedCommand` is often **non-actionable** (retry rejected for `running` tasks). Dashboard wave panel can show `[completed]` under the same drift.

Root causes cluster into:

1. **Detection without terminal reconcile** — `detectBatchStateDrift` flags `doneInLane` gap but nothing promotes cache to terminal success.
2. **Actionable-command gap** — `buildSuggestedCommand("state_drift")` suggests `pause && retry` while task remains `running`.
3. **Pause/resume SIGTERM orphan** — `resume --force` terminates paused attached engine via `terminateStaleDetachedEngine`, leaving `engine_orphaned` with lane `.DONE` on disk.
4. **Macro/dashboard optimism** — `deriveMacroPhase` and `buildWaveProgress` treat `terminal-success` classification as success without gating on active drift/orphan diagnosis.

---

## Incident batch A — `20260705T210857` (#170)

**Context:** v1.7.0 release wave 0 (SP-440, SP-452, SP-458, SP-468).  
**Journal source:** `/Users/cdelgado/Documents/github/pi-spine/.spine/runtime/20260705T210857/journal/events.jsonl` (replayed via `spine journal replay --batch 20260705T210857`).

### Symptom (operator view)

| Field | Value |
|-------|-------|
| Task | SP-440 |
| Lane evidence | `.DONE`, commit `674b79f`, STATUS Step 4 complete |
| Batch-state | `status: running` |
| Diagnosis | `state_drift` |
| Macro phase | `Failed` |
| suggestedCommand | `spine batch pause && spine batch retry SP-440` |
| Retry result | `Task SP-440 is running — only failed tasks can be retried` |

### Journal timeline (SP-440, condensed)

| Timestamp | Event | Notes |
|-----------|-------|-------|
| 21:21:20 | `task.step_completed` | Step 4 |
| 21:23:14 | `engine.orphan_terminated` | `fromPhase: paused`, SIGTERM |
| 21:23:19 | `lane.completed` | Lane done |
| 21:33:20 | `review.completed` | APPROVE (code review) |
| 21:33:20 | `task.verdict_recorded` | APPROVE |
| 21:41:29 | `contract.test_retry` | exit 1 |
| 21:49:08 | `contract.failed` → `task.failed` | contract_failed |
| 21:54:46 | `task.retry_requested` | Operator recovery |
| 21:55:23 | `engine.orphan_terminated` | `fromPhase: paused` again |
| 22:11:23 | `lane.completed` + `review.crash_recovered` | APPROVE verdict |
| 22:18:37 | `contract.verified` | ok: true |
| 22:24:53 | `task.failed` | worker_orphaned |
| 22:40:17 | `task.completed` | `skippedDoneOnDisk: true` — eventual recovery |

### Root cause chain

1. **Lane completes; cache does not.** `lane.completed` + `review.completed` APPROVE + `task.verdict_recorded` occur while batch-state still shows `running` (no `task.completed` / `task.succeeded` transition applied to cache).

2. **Drift detected, not healed.** `detectBatchStateDrift` in `journal-rebuild.mjs` flags `doneInLane` when:
   - cache status ∈ `{pending, running}`
   - classified task shows `doneInLane` or `terminal-success` without journal terminal lifecycle

   ```515:526:src/batch/journal-rebuild.mjs
   if (
     NON_TERMINAL_CACHE_STATUSES.has(cachedStatus) &&
     classifiedShowsDoneInLaneDrift(classified) &&
     !hasJournalTerminalLifecycle(lastEvent)
   ) {
     entries.push({ taskId, field: "doneInLane", ... });
   }
   ```

3. **Diagnosis prioritizes drift.** `deriveDiagnosis` returns `state_drift` when `signals.stateDrift.drifted` (before `needs_retry` doneInLane path at lines 882–894).

4. **Non-actionable command.** When `phase === "running"`:

   ```170:176:src/batch/diagnosis.mjs
   case "state_drift":
     if (ctx.failedTaskId) {
       if (ctx.phase === "running") {
         return `spine batch pause && spine batch retry ${ctx.failedTaskId}`;
       }
   ```

   Retry validation rejects `running` tasks — operator deadlock (#170, #168).

5. **Macro phase misleading.** `state_drift` ∈ `FAILED_DIAGNOSES` → macro `Failed` even while other lanes (SP-452, SP-458) continue (#165).

### Code anchors

| Concern | File | Function / area |
|---------|------|-----------------|
| Drift detection | `src/batch/journal-rebuild.mjs` | `detectBatchStateDrift`, `classifiedShowsDoneInLaneDrift` |
| Diagnosis | `src/batch/reconcile.mjs` | `deriveDiagnosis` (lines 877–894) |
| Suggested command | `src/batch/diagnosis.mjs` | `buildSuggestedCommand` case `state_drift` |
| doneInLane semantics | `src/batch/diagnosis-task-done.mjs` | `classifyTaskDoneSemantics` |
| Existing test (detection only) | `tests/batch/journal-rebuild-drift.test.mjs` | SP-445 doneInLane flag |
| Broken command test | `tests/cli/spine-diagnosis-state-drift.test.mjs` | Asserts pause+retry is correct — **must change in SP-512** |

### Fix target: **SP-512** (FR-STA-01, FR-STA-03)

- **Terminal reconcile:** When lane `.DONE` + review APPROVE (+ journal terminal events), idempotently promote batch-state task to `succeeded` (or emit `reconcile` command that succeeds).
- **Actionable suggestedCommand:** Replace `pause && retry` on `running` with e.g. `spine batch reconcile` / `resume --force` / auto-reconcile on diagnose — must not suggest retry that validation rejects.
- **Tests:** New `tests/batch/reconcile-done-inlane-terminal.test.mjs`; update `spine-diagnosis-state-drift.test.mjs`.

---

## Incident batch B — `20260706T052912` (#184)

**Context:** v1.8.0 release wave 0 (SP-497–SP-499, SP-500, SP-502).  
**Journal source:** `/Users/cdelgado/Documents/github/pi-spine/.spine/runtime/20260706T052912/journal/events.jsonl`.

### Symptom (operator view)

| Field | Value |
|-------|-------|
| Diagnosis | `engine_orphaned` |
| Macro phase | `Failed` |
| Tasks SP-497/498/499 | `classification: terminal-success`, `doneInLane: true`, `status: running` |
| suggestedCommand | `spine batch resume --attached` |

### Journal timeline (key events)

| Timestamp | Event | Notes |
|-----------|-------|-------|
| 05:53:09 | `lane.completed` | SP-497 |
| 05:56:43 | `batch.paused` | Operator pause during recovery |
| 05:57:09 | `engine.orphan_terminated` | `stalePid: 1921`, `fromPhase: paused`, SIGTERM |
| 05:57:11 | `batch.resumed` | `resumeForced: true` |
| 06:02:18 | `contract.verified` | SP-497 ok |
| 06:03:24 | `batch.paused` | Second pause |
| 06:03:46 | `engine.orphan_terminated` | `stalePid: 38234`, `fromPhase: paused` |
| 06:04:20 | `contract.test_retry` | SP-497 exit 1 during recovery |
| 16:13:27 | `engine.orphan_terminated` | Third orphan during pause |
| 16:26:49 | `task.completed` | SP-497 `skippedDoneOnDisk: true` — partial recovery |

### Root cause chain

1. **Pause + force-resume kills engine.** `enforceAttachedEngineSingleOwner` / resume path calls `terminateStaleDetachedEngine` with `fromPhase: "paused"`:

   ```56:60:src/batch/resume-engine.mjs
   const eligiblePhase =
     fromPhase === "paused" ||
     fromPhase === "failed" ||
     ...
   ```

   Attached engine receives SIGTERM while paused; journal records `engine.orphan_terminated`.

2. **Orphan detect fires.** `detectOrphanRunning` sees dead `enginePid` + running tasks in scoped post-resume journal → `engine_orphaned`.

3. **Lane truth ignored.** Tasks have `.DONE` + `contract.verified` but cache stays `running`; no reconcile promotes to `succeeded` after resume.

4. **Compounding factor:** Rogue nested `spine batch start` in lane worktree during contract testCommand (noted in #184) — separate from SIGTERM path but worsens drift.

### Code anchors

| Concern | File | Function / area |
|---------|------|-----------------|
| SIGTERM on pause resume | `src/batch/resume-engine.mjs` | `terminateStaleDetachedEngine` |
| Attached single-owner | `src/batch/attached-runner.mjs` | `enforceAttachedEngineSingleOwner` (lines 173–200) |
| Post-merge limbo finalize | `src/batch/attached-runner.mjs` | `finalizeResumePostMergeLimbo` |
| Orphan detection | `src/batch/orphan-detect.mjs` | `detectOrphanRunning`, `journalEventsSinceResume` |
| Orphan reconcile | `src/batch/reconcile.mjs` | `reconcileOrphanRunningState` (fails tasks, does not promote doneInLane) |
| Handoff | `src/batch/attached-engine-handoff.mjs` | Engine PID lifecycle |

### Fix target: **SP-513** (FR-STA-02)

- Paused batch resume must not orphan engine when prior engine was paused (not stale).
- After resume, reconcile lane `.DONE` + `contract.verified` → `task.succeeded`.
- **Tests:** `tests/batch/attached-pause-resume-sigterm.test.mjs` simulating pause → SIGTERM → resume.

---

## Cross-cutting gaps (SP-514–519)

### SP-514 — Incident fixtures (FR-STA-06)

Export journal slices + batch-state snapshots from both batches into:

- `tests/fixtures/incidents/v181-batch-20260705T210857.json`
- `tests/fixtures/incidents/v181-batch-20260706T052912.json`

Integration tests replay and assert reconcile/diagnosis after SP-512/513 land. **Depends:** SP-512, SP-513.

### SP-515 — Macro phase active workers (#165, FR-STA-04)

**Problem:** `deriveMacroPhase` maps `state_drift` and `engine_orphaned` to macro `failed` unconditionally:

```58:67:src/batch/macro-phase.mjs
const FAILED_DIAGNOSES = new Set([
  "failed", "needs_retry", "worker_orphaned", "engine_orphaned",
  "state_drift", ...
]);
```

When `batchPhase === "running"` and lane workers are alive (heartbeats, contract verify), macro should be `executing` (or `Recovering`), not `Failed`.

**Fix:** Gate `FAILED_DIAGNOSES` on `hasActiveWorkerTasks` / live PIDs. See `diagnosis-tail-state.mjs` / `isRunningWithoutActiveWorkers`.

**Tests:** `tests/batch/macro-phase-active.test.mjs`.

### SP-516 — Status/classification alignment (#166)

**Problem:** After retry/resume, `status` (cache) and `classification` (reconcile) diverge — e.g. `status: failed` + `classification: terminal-success` for SP-454/SP-441 in batch `20260704T233623`.

**Fix:** On retry/resume reconcile, sync `classification` with reconciled terminal state in `reconcile.mjs` / `lifecycle.mjs`.

**Tests:** `tests/batch/status-classification-align.test.mjs`.

### SP-517 — Dashboard wave completed under drift (#186, FR-STA-05)

**Problem:** `resolveWaveStatus` returns `completed` when all tasks have `classification === "terminal-success"` — ignores active `state_drift` / `engine_orphaned`:

```24:27:src/dashboard/snapshot-waves.mjs
if (classifiedTasks?.length && waveTasksAllTerminalSuccess(taskIds, classifiedTasks)) {
  return "completed";
}
```

Lane status was fixed in SP-447; waves were not (#186).

**Fix:** Pass `diagnosis` + `endedAt` into `buildWaveProgress`; do not mark wave `completed` under drift/orphan while batch non-terminal.

**Tests:** `tests/dashboard/wave-panel-drift-truth.test.mjs`. Existing partial coverage: `tests/dashboard/snapshot.test.mjs` line 230 (lane, not wave).

### SP-518 — Attached SIGKILL guard (#163 partial)

Doctor warn + runbook for attached orphan risk (background resume, SIGKILL exit 137). No engine hardening — v1.10.0. **Parallel** with SP-513.

### SP-519 — State drift recovery docs (#168)

Update `skills/spine-release-operator/SKILL.md` and `docs/adoption/operator-runbook.md` after SP-512 lands — remove broken `pause && retry` on running tasks. **Depends:** SP-512.

---

## Phase 59 FR-STA mapping

| FR | Description | Task | Status |
|----|-------------|------|--------|
| FR-STA-01 | doneInLane + terminal artifacts → batch-state terminal reconcile | SP-512 | Gap confirmed |
| FR-STA-02 | Pause/resume survives without engine_orphaned | SP-513 | Gap confirmed |
| FR-STA-03 | state_drift suggestedCommand always actionable | SP-512 | Gap confirmed |
| FR-STA-04 | Macro phase accurate when batch running + workers active | SP-515 | Gap confirmed |
| FR-STA-05 | Dashboard wave panel reflects disk truth under drift/orphan | SP-517 | Gap confirmed |
| FR-STA-06 | Incident fixture regression for both batches | SP-514 | Fixtures not yet created |
| FR-STA-07 | Attached pause phase persistence | SP-449 | Staged M — v1.8.2 |
| FR-STA-08 | Skip clears failed segment for wave merge | SP-442 | Staged M — v1.8.2 |

---

## Test recommendations (for SP-512+)

| Test file | Scenario |
|-----------|----------|
| `reconcile-done-inlane-terminal.test.mjs` | Cache `running` + lane `.DONE` + review APPROVE → reconcile promotes to `succeeded` |
| `spine-diagnosis-state-drift.test.mjs` | **Invert** running-phase test: suggested command must not be `pause && retry` when retry would fail |
| `attached-pause-resume-sigterm.test.mjs` | pause → orphan_terminated → resume → no `engine_orphaned` |
| `macro-phase-active.test.mjs` | `state_drift` + live workers → macro ≠ `failed` |
| `status-classification-align.test.mjs` | Post-retry status/classification agree |
| `wave-panel-drift-truth.test.mjs` | `terminal-success` + `state_drift` → wave ≠ `completed` |
| `v181-batch-*.json` fixtures | Full journal replay integration (SP-514) |

**Regression gate (PRD §9):** `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run coverage:check`

---

## Wave run order (confirmed from PRD §9)

```text
SP-511 (this document)
  ├── SP-512 ──┬── SP-514
  │            ├── SP-515
  │            ├── SP-516
  │            └── SP-519
  └── SP-513 ──┘
SP-518 (parallel)
SP-517 (after SP-512 or with SP-447 chain)
```

---

## Baseline already landed (do not re-implement)

Per PRD §3: SP-174/175 journal rebuild, SP-496 state_drift UX (#164), SP-375/376 attached pause, SP-111/115 orphan taxonomy, SP-445 doneInLane **detection** (not terminal reconcile). SP-512 must extend — not duplicate — SP-445 detection.

---

## Operator workarounds observed (incidents)

| Workaround | Effect |
|------------|--------|
| `spine batch resume --force` | Advanced SP-440 to review path; did not clear drift (#170) |
| Manual batch-state JSON edit | Avoid — fixtures must prove replay without this |
| `task.completed` with `skippedDoneOnDisk` | Eventual recovery in both batches; not operator-actionable |

---

## References

- GitHub: [#170](https://github.com/beettlle/pi-spine/issues/170), [#184](https://github.com/beettlle/pi-spine/issues/184), [#165](https://github.com/beettlle/pi-spine/issues/165), [#166](https://github.com/beettlle/pi-spine/issues/166), [#186](https://github.com/beettlle/pi-spine/issues/186), [#168](https://github.com/beettlle/pi-spine/issues/168)
- PRD: [`docs/PRD-v1.8.1-reconciliation-handoff.md`](../../../docs/PRD-v1.8.1-reconciliation-handoff.md)
- Downstream packets: `spine-tasks/SP-512-*` through `SP-519-*`
