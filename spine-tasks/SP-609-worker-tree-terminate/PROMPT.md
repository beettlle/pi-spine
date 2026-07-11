# Task: SP-609 — Worker tree terminate

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Extend dismiss/abort/stall teardown to reap nested `pi` grandchildren, not only tracked runner PID.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #194 — Abort, dismiss, stall timeout, and hung-worker teardown must terminate the **full worker tree** (spine-worker-runner + nested `pi` + tool children). Today `terminateLaneWorkers` only `process.kill`s the tracked `workerPid`, leaving idle `pi` processes (~300–450 MB) after teardown.

**Source:** [`docs/PRD-v2.3.1-reliability-handoff.md`](../../docs/PRD-v2.3.1-reliability-handoff.md) §6 FR-REL231-02

**Related:** Incomplete follow-up to #28 / SP-337 (runner PID kill only).

## Dependencies

- **None**

## Context to Read First

- [`src/batch/worker-host.mjs`](../../src/batch/worker-host.mjs) — `terminateLaneWorkers`
- [`bin/spine-worker-runner.mjs`](../../bin/spine-worker-runner.mjs) — `spawnSync("pi", …)` grandchild
- [`tests/batch/dismiss-orphan-worker-kill.test.mjs`](../../tests/batch/dismiss-orphan-worker-kill.test.mjs)
- [`docs/adoption/operator-runbook.md`](../../docs/adoption/operator-runbook.md)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/worker-host.mjs`
- `src/process/`
- `bin/spine-worker-runner.mjs`
- `tests/batch/dismiss-orphan-worker-kill.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/dismiss-orphan-worker-kill.test.mjs` |
| fileScopeMustChange | `src/batch/worker-host.mjs`, `docs/adoption/operator-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] Trace dismiss/abort/stall → `terminateLaneWorkers` call sites
- [ ] Confirm runner→`pi` grandchild relationship in worker-runner

### Step 1: Tree terminate helper

- [ ] Add shared process-group / tree terminate helper (prefer `src/process/` if a small module fits)
- [ ] Wire helper into dismiss, abort, stall kill, and hung-worker teardown paths that use `terminateLaneWorkers`
- [ ] Optionally adjust worker-runner spawn so the tree is killable (process group) without breaking stub mode

### Step 2: Tests + runbook

- [ ] Regression: fake grandchild dies when tracked `workerPid` is torn down
- [ ] Short operator-runbook note: detect leftover `pi` (`pgrep` / `SPINE_BATCH_ID`) if any remain

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — leftover `pi` detection / cleanup note after abort/dismiss

**Check If Affected:**
- None

## Completion Criteria

- [ ] Teardown reaps nested `pi` for the lane worker tree
- [ ] Regression test covers grandchild kill
- [ ] Runbook documents leftover detection
- [ ] Issue #194 closable after land

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Change diagnose headlines or lane orch sync (SP-608 / SP-610)

## Git Commit Convention

- `fix(SP-609): tree-kill worker runner and pi grandchildren`
