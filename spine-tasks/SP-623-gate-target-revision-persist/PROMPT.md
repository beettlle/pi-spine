# Task: SP-623 — Persist targetRevision on gate open

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Additive field on gate open; limited blast radius if scoped to persist helper.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #121 — Persist a durable `targetRevision` on integrate gate records when the gate is opened (and on refresh if applicable) so later use can detect stale approvals.

**Revision source (explore):** orch tip SHA at gate open (`batchState.orchBranch` via `git rev-parse`); fail closed if unreadable.

**Source:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../docs/PRD-v2.5.0-gate-maturity-handoff.md) §6 FR-REL250-01

**Explore:** [`spine-tasks/_explore/v2.5-gate-maturity/findings.md`](../_explore/v2.5-gate-maturity/findings.md)

## Dependencies

- **None**

## Context to Read First

- `src/batch/gate.mjs` — `openIntegrateGate`
- `src/batch/gate-evidence-read.mjs` — `save`/`loadGateRecord` path
- `spine-tasks/_explore/v2.5-gate-maturity/findings.md`
- GitHub [#121](https://github.com/beettlle/pi-spine/issues/121)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/gate.mjs`
- `src/batch/gate-revision.mjs`
- `tests/batch/gate-target-revision-persist.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/gate-target-revision-persist.test.mjs` |
| fileScopeMustChange | `src/batch/gate-revision.mjs`, `tests/batch/gate-target-revision-persist.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Persist helper + open wiring

- [ ] Add helper to resolve orch tip SHA (or documented fallback) as `targetRevision`
- [ ] Set `targetRevision` on new gate records in `openIntegrateGate`
- [ ] Atomic save via existing gate I/O

### Step 2: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Must Update docs modified (if any)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-633 owns operator docs

## Completion Criteria

- [ ] Gate records include `targetRevision` after open
- [ ] Regression test covers persist path

## Do NOT

- Implement validate-on-use (SP-624)
- Add postures or blockers
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-623): persist targetRevision on gate open`

