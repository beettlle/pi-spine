# Task: SP-619 — Persist batch-meta.json

**Created:** 2026-07-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** New survival artifact at batch start; medium novelty, limited blast radius if scoped to write path only.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #126 — Persist minimal wave topology to `.spine/runtime/{batchId}/batch-meta.json` at batch start so operators can reconstruct state after abort when `batch-state.json` is missing or corrupt.

**Minimum fields:** `baseBranch`, `orchBranch`, `totalWaves`, `mode`, `tasksRoot`, wave→task mapping.

**Source:** [`docs/PRD-v2.4.0-recovery-batch-meta-handoff.md`](../../docs/PRD-v2.4.0-recovery-batch-meta-handoff.md) §6 FR-REL240-03

**Upstream reference:** Taskplane `saveBatchMetaRuntimeArtifact` (issue #126).

## Dependencies

- **None**

## Context to Read First

- [`src/batch/state-io.mjs`](../../src/batch/state-io.mjs) — atomic JSON patterns
- [`src/batch/engine.mjs`](../../src/batch/engine.mjs) — `startBatch`
- [`src/batch/detached-run.mjs`](../../src/batch/detached-run.mjs) — `startBatchDetached`
- [`src/fs/atomic-write.mjs`](../../src/fs/atomic-write.mjs)
- GitHub [#126](https://github.com/beettlle/pi-spine/issues/126)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/batch-meta.mjs`
- `src/batch/engine.mjs`
- `src/batch/detached-run.mjs`
- `src/batch/lifecycle.mjs`
- `tests/batch/batch-meta-persist.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-meta-persist.test.mjs` |
| fileScopeMustChange | `src/batch/batch-meta.mjs`, `tests/batch/batch-meta-persist.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm no existing `batch-meta` module; map where batchId + topology are known at start
- [ ] Choose write path under `.spine/runtime/{batchId}/batch-meta.json`

### Step 1: Persist helper + start wiring

- [ ] Add `saveBatchMetaRuntimeArtifact` (or equivalent) with atomic write
- [ ] Call it from batch start (attached and detached paths that create a live batch)
- [ ] Include minimum fields from Mission; schema version field if helpful

### Step 2: Testing & Verification

- [ ] Add `tests/batch/batch-meta-persist.test.mjs` asserting file exists with required keys after start
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-621 owns the operator section

## Completion Criteria

- [ ] `batch-meta.json` written at batch start with required topology fields
- [ ] Public start APIs unchanged aside from additive persist side-effect
- [ ] Regression test covers persist path

## Do NOT

- Implement reconstruct / force-resume (SP-620)
- Expand into salvage or abort behavior changes
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-619): persist batch-meta.json at batch start`
