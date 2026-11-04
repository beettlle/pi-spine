# SP-850: Diagnose: a task in review is not state drift; no `resume --force` while the engine is live — Status

**Current Step:** Complete
**Status:** ✅ Done — verification green
**Last Updated:** 2026-11-03
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `detectBatchStateDrift` and the suggested-command builder; report the blast radius in STATUS
- [x] `rg -n "resume --force" tests/` — every test that asserts the current `state_drift` suggestion is in the Contract or listed in Discoveries for post-integrate `release:check`
- [x] Confirm the review and contract event names in `src/batch/journal.mjs`

**Blast radius (GitNexus, both CRITICAL — additive guards only, files in scope):**

- `detectBatchStateDrift` (`src/batch/journal-rebuild-drift.mjs`): 27 impacted symbols, direct caller `reconcileBatch` (`src/batch/reconcile-batch.mjs`); 12 processes touched (runSpineHandoff, runLaneLogs, openGateFromSalvageEvidence, dashboard `server`, collectEvidenceBundle, writeBatchPostMortem, runSequenceWaveLandLoop, buildIssueDraftBody, runSupervisorMonitorLoop, runSequence, runSpineSequence, buildDashboardSnapshot); modules Batch (direct), Cli/Dashboard (indirect).
- `buildSuggestedCommand` (`src/batch/diagnosis-suggested-command.mjs`): 20 impacted symbols, direct caller `buildDiagnosisOutput` (`src/batch/diagnosis.mjs:331`); reaches completeBatch/dismissBatch lifecycle, CLI status output, dashboard.

**Preflight facts:**

- ctx wiring confirmed: `reconcileBatch` computes `engineStillRunning = enginePid != null && !staleEnginePid` (`reconcile-batch.mjs:401-403`) → `buildReconcileDiagnosisContext` passes it (`reconcile-diagnosis-context.mjs:105`) → `buildDiagnosisOutput` → `buildSuggestedCommand`.
- Event names: reviews emit `review.started` / `review.completed` / `review.failed` with payload `reviewType` ∈ {`code`, `plan`, `final`} (`review-code.mjs:75-87`, `review-plan.mjs:176-188`, `review-step-run.mjs`, final at `review-final.mjs:337` uses `"final"`); contract verify emits `contract.verified` with `payload.ok` / `contract.failed` (`review-final.mjs:143,304`). There is **no** contract-verify "started" event — the in-flight verify window is inferred as "review pipeline event seen, no terminal lifecycle".
- Existing `state_drift` suggestion tests (`tests/batch/spine-diagnosis-state-drift.test.mjs`, `tests/cli/spine-diagnosis-state-drift.test.mjs`) never pass `engineStillRunning`, so a live-engine wait branch added ahead of the current conditions keeps them green. Contract `testCommand` is `npm test` (full suite) — all `resume --force` assertions run in Contract; no `release:check` discovery needed.

### Step 1: Drift skip for open post-`.DONE` work
**Status:** ✅ Complete

- [x] Helper `journalHasOpenPostDonePipeline(events, taskId)` exported from `src/batch/journal-rebuild-drift.mjs` — true when the task's journal shows any review/contract pipeline event (`review.started`/`completed`/`failed`, `contract.verified`/`failed`, `task.verdict_recorded`)
- [x] `detectBatchStateDrift` doneInLane branch: entry suppressed only while the pipeline is open AND `journalShowsDoneInLaneTerminalArtifacts` is incomplete; the entry is kept when the terminal-artifact signature is complete so `reconcileBatchStateDrift` still heals (#170)

### Step 2: Live-engine suggestion
**Status:** ✅ Complete

- [x] `buildSuggestedCommand` `state_drift` case: `ctx.phase === "running" && ctx.engineStillRunning === true` → `spine wait --until completed,failed,needs_integrate --timeout 2h` (same string as `engine_still_running`)
- [x] Dead/stale engine (`engineStillRunning !== true`) keeps `spine batch resume --force` — no existing test/behavior changed (all pre-existing tests never pass `engineStillRunning`)

### Step 3: Tests
**Status:** ✅ Complete

- [x] Open code / final review and open contract verify → no drift
- [x] Terminal journal with stale cache → drift
- [x] Suggested command: live → `spine wait …`; dead/stale → `spine batch resume --force`

Coverage beyond the packet minimum (see Execution Log): other-task pipeline events do not suppress; terminal-artifacts-complete still flags (v181/#170 heal shape); `contract.verified`-before-`task.completed` window; helper unit tests; live/dead/stale/compat suggested-command matrix in both test files.

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`; the engine then runs the stet `reviewCommand` — full suite executed in the contract environment (see Verification); engine-owned stet review runs post-`.DONE`
- [x] Fix all failures — 61 in-worker failures were all pre-existing `SPINE_IS_WORKER=1` env artifacts (see Discoveries); identical suite is 3207/3207 green without the env key

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-850-diagnose-review-not-drift/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Worker-shell test runs inherit `SPINE_IS_WORKER=1` (SP-482 nested-spawn guard) → 61 env-caused suite failures; the engine's contract verify strips the key (`buildContractTestEnv`, SP-491/#155) and passes | Env artifact, not a regression — validate with `env -u SPINE_IS_WORKER`; failing-file set (25 files) run pristine-vs-changed: identical 84/54 both ways | scripts/run-coverage.mjs, src/batch/contract-spawn.mjs:39 |
| First-cut drift skip (`pipeline open → suppress`) broke the v181/#170 heal: `incident-replay-v181` expected `succeeded`, got `running`, because `reconcileBatchStateDrift` consumes the doneInLane entry when terminal artifacts are complete | Fixed — gate now suppresses only when `journalShowsDoneInLaneTerminalArtifacts` is incomplete | src/batch/journal-rebuild-drift.mjs |
| `A && B && C && D \|\| E` precedence bug made the gate fire in exactly the window meant for suppression | Fixed — `\|\|` group parenthesized | src/batch/journal-rebuild-drift.mjs |
| Contract verify has no "started" journal marker — it only journals `contract.verified`/`contract.failed` on completion (`review-final.mjs:143,304`); the in-flight window is journaled as a resolved review with no terminal lifecycle, indistinguishable from the #170 healable state | By design — drift entry kept for the healable state; the live-engine case is handled at the suggested-command layer (Step 2) | src/batch/journal-rebuild-drift.mjs |
| `detect_changes` vs lane base `49b4adcf`: 7 symbols touched, risk medium; `normalizeTaskFolderRel`/`laneDoneMarkerCommittedOnBranch`/`journalShowsDoneInLaneTerminalArtifacts`/`classifiedShowsDoneInLaneDrift` are line-shift attribution only | Verified — diff shows no body changes for those symbols | — |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |
| 2026-11-03 | Step 0 committed (`d1873271`) | Blast radius + event names confirmed |
| 2026-11-03 | Steps 1–3 committed (`b4647a14`) | Drift gate + live-engine wait suggestion + tests |
| 2026-11-03 | `npm run typecheck` | ✅ pass |
| 2026-11-03 | Coverage gate, contract environment (`env -u SPINE_IS_WORKER npm run coverage:check`) | ✅ 3207/3207 pass, 0 fail; line coverage 91.36% ≥ 77% |
| 2026-11-03 | `./scripts/worker-verify.sh` in worker shell | exit 1 — 61 pre-existing `SPINE_IS_WORKER=1` artifacts only; no regression vs pristine baseline |
| 2026-11-03 | `.DONE` created | Task complete |

## Blockers

*None*
