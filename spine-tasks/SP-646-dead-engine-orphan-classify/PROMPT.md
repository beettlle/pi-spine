# Task: SP-646 — Dead engine orphan classify

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Classification + single recovery command for dead engine multi-lane orphan.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

**Partial:** [#203](https://github.com/beettlle/pi-spine/issues/203)

When the batch engine PID is dead and lane worker PIDs are stale while tasks still look `running` / `worker_orphaned`, diagnose must classify cleanly as orphan (or equivalent) with **one** actionable `suggestedCommand` (retry the stuck task or abort — pick the existing operator-safe pattern). Do not leave operators bouncing between retry/resume/pause with contradictory phase checks.

## Dependencies

- **None**

## Context to Read First

- `src/batch/orphan-detect.mjs`
- `src/batch/diagnosis.mjs`
- `src/batch/reconcile-diagnosis.mjs`
- GitHub #203 (batch `20260712T234002`)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/orphan-detect.mjs`
- `src/batch/reconcile-diagnosis.mjs`
- `tests/batch/orphan-dead-engine.test.mjs` (or extend existing orphan tests)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/orphan-dead-engine.test.mjs` |
| fileScopeMustChange | `src/batch/orphan-detect.mjs` |

## Steps

### Step 0: Preflight

- [ ] Map #203 signals (dead enginePid, stale lane PIDs, multi-lane running)
- [ ] Trace current `worker_orphaned` / `engine_orphaned` branches

### Step 1: Classify dead-engine multi-lane orphan

- [ ] Dead engine + stale lanes → stable orphan diagnosis
- [ ] Single primary `suggestedCommand` (retry or abort per existing safe pattern)
- [ ] Headline distinguishes dead-engine orphan from live-engine stalls

### Step 2: Testing & Verification

- [ ] Regression for dead-engine multi-lane classification
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-641 + SP-648)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-641

## Completion Criteria

- [ ] Dead engine + stale lanes classifies with one recovery command
- [ ] Regression covers #203 signal shape

## Do NOT

- Implement retry/abort limbo clearing (SP-647)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-646): classify dead-engine multi-lane orphan (#203)`
