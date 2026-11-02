# Task: SP-856 — Integrate and batch complete tell the operator to wait while the engine finishes its land loop

**Created:** 2026-11-01
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Land-loop guidance is followed literally by agents. A wrong suggestion either archives an active batch or keeps reporting healthy batches as failed.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** After `spine gate approve`, `spine integrate` returns `suggestedCommand: "spine batch complete"` (`src/batch/integrate.mjs` ~166 already-merged path, ~408 success path) while the detached engine is still in its land loop (`phase: running`). `spine batch complete` then hits `reloadStateForTerminalWrite` (`src/batch/lifecycle-archive.mjs` ~48-80): `requireTerminalPhase` + `ACTIVE_RESUME_PHASES` correctly refuse, but the refusal is the generic `batch_state_changed_during_terminal_write`, and `formatLifecycleHuman` (`bin/spine-batch.mjs` ~114) prints the `Batch lifecycle failed` headline. Seconds later the engine journals `batch.land_loop_finalized` and the batch is `completed`. Liveness helpers exist: `isEngineProcessAlive` (`src/process/liveness.mjs` ~184), `readBatchEnginePid` / `readBatchEngineStartedAt` (used in `src/batch/diagnosis-pending-lane.mjs` ~42).

## Mission

Closes #371 — While a live engine is still finalizing after integrate, both commands say to wait, and nothing reports a failure:

1. **Integrate** — When the batch phase is active (`ACTIVE_RESUME_PHASES`) and the recorded engine PID is alive, `suggestedCommand` is `spine wait --until completed --timeout 10m` and `alternatives` includes `spine batch complete`. Otherwise unchanged. Keep the output block consistent with #359 (do not add a gate line).
2. **Complete refusal** — In `reloadStateForTerminalWrite`, when the active-phase refusal fires and the engine PID is alive, return `error: "engine_finishing_land_loop"`, `pending: true`, headline `Engine is finishing the land loop — wait for it to complete`, `suggestedCommand: "spine wait --until completed --timeout 10m"`. Other refusals are unchanged.
3. **Headline** — `formatLifecycleHuman` prints `Batch lifecycle pending` (not `failed`) when `result.pending === true`. Exit code stays non-zero.
4. **Tests** — complete while phase `running` with a live engine PID (injected liveness) → `engine_finishing_land_loop`, pending headline; dead PID → existing refusal; integrate with live engine → `spine wait …` suggestion.

## Dependencies

- **None**

## Context to Read First

- GitHub #371 (and #359 for the same output block)
- `src/batch/integrate.mjs` 150-175, 395-415
- `src/batch/lifecycle-archive.mjs` 1-100
- `bin/spine-batch.mjs` 105-140
- `src/process/liveness.mjs` 170-210; `src/batch/diagnosis-pending-lane.mjs` 30-50
- `tests/batch/batch-complete-engine.test.mjs`, `tests/batch/integrate.test.mjs`, `tests/batch/late-finalize-after-complete.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio + OpenJev for the stet `reviewCommand` only
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/integrate.mjs` — 438 lines; net ≤ +20 (liveness check in a small local helper)
- `src/batch/lifecycle-archive.mjs`
- `bin/spine-batch.mjs`
- `tests/batch/batch-complete-engine.test.mjs`
- `tests/batch/integrate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/batch-complete-engine.test.mjs tests/batch/integrate.test.mjs tests/batch/late-finalize-after-complete.test.mjs tests/batch/salvage-complete-after-integrate.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-856` |
| fileScopeMustChange | `src/batch/lifecycle-archive.mjs`, `tests/batch/batch-complete-engine.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `reloadStateForTerminalWrite`, `formatLifecycleHuman`, and the integrate result builder; report the blast radius in STATUS
- [ ] `rg -n "batch_state_changed_during_terminal_write|suggestedCommand: \"spine batch complete\"" tests/` — list assertions that change

### Step 1: Complete refusal + headline

- [ ] Live-engine active-phase refusal returns `engine_finishing_land_loop`, `pending: true`, wait suggestion
- [ ] `formatLifecycleHuman` prints `Batch lifecycle pending` for pending results

**Artifacts:**
- `src/batch/lifecycle-archive.mjs`, `bin/spine-batch.mjs` (modified)

### Step 2: Integrate suggestion

- [ ] Live engine in an active phase → `spine wait --until completed --timeout 10m`, `spine batch complete` in alternatives

**Artifacts:**
- `src/batch/integrate.mjs` (modified)

### Step 3: Tests

- [ ] Complete with live / dead engine PID
- [ ] Integrate with live engine

**Artifacts:**
- `tests/batch/batch-complete-engine.test.mjs`, `tests/batch/integrate.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-856-integrate-live-engine-wait/.DONE`

**Stet review (Contract `reviewCommand`, blocking):** fix real defects in this task's diff. For a stet false positive, `stet dismiss <id> <reason>` citing lint/typecheck/test evidence, record it under Discoveries, and file it at https://github.com/beettlle/stet/issues. Never edit `.review/` or remove the `reviewCommand`.

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `skills/spine-release-operator/SKILL.md` §4.3 land loop (note in Discoveries; do not edit)

## Completion Criteria

- [ ] No `Batch lifecycle failed` headline while a live engine finishes its land loop
- [ ] Integrate suggests `spine wait` when the engine is still live

## Git Commit Convention

- `fix(SP-856): integrate and complete suggest wait while engine finalizes`

## Do NOT

- Let `spine batch complete` archive a batch whose engine is still running
- Change the #359 gate line behavior
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
