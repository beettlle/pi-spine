# Task: SP-532 — Harness complete waits engine

**Created:** 2026-07-07
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Lifecycle race fix — complete must refuse archive while batch engine PID is alive.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Implement FR-STA-22: `spine batch complete` must **not archive** batch state while the batch engine is still running ([#173](https://github.com/beettlle/pi-spine/issues/173)). Refuse complete with clear diagnosis when `resilience.enginePid` is alive; wait or suggest operator action.

**Closes:** [#173](https://github.com/beettlle/pi-spine/issues/173)

## Dependencies

- **None**

## Context to Read First

- [`docs/PRD-v1.10.0-release-harness-handoff.md`](../../docs/PRD-v1.10.0-release-harness-handoff.md) §FR-STA-22, M-HARNESS-02
- [`src/batch/lifecycle.mjs`](../../src/batch/lifecycle.mjs) `completeBatch`
- [`src/batch/state.mjs`](../../src/batch/state.mjs) `readBatchEnginePid`
- [`src/batch/sequence.mjs`](../../src/batch/sequence.mjs) `waitForSequenceBatchTerminal`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lifecycle.mjs`
- `src/batch/batch-state-io.mjs`
- `tests/batch/batch-complete-engine.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-complete-engine.test.mjs` |
| fileScopeMustChange | `src/batch/lifecycle.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #173 reproduction: complete archives while next-wave engine runs
- [ ] Trace `completeBatch` → `archiveBatchState` path

### Step 1: Engine-alive guard

- [ ] Before archive in `completeBatch`, check `readBatchEnginePid` + `isProcessAlive`
- [ ] Return `ok: false` with diagnosis hint `engine_still_running` and `suggestedCommand: spine wait --until completed,failed,needs_integrate --timeout 2h`

### Step 2: Regression tests

- [ ] `tests/batch/batch-complete-engine.test.mjs`: complete refused when engine PID alive; allowed when dead/null

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Comment on #173
- [ ] Create `.DONE`

## Completion Criteria

- [ ] `batch complete` does not archive when engine PID is alive (M-HARNESS-02)
- [ ] Clear operator-facing error and suggested wait command

## Do NOT

- Change sequence runner wave logic beyond complete guard
- Terminate engine automatically from complete path

## Git Commit Convention

- `fix(SP-532): refuse batch complete while engine running`
