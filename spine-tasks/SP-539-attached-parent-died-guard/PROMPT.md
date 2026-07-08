# Task: SP-539 — Attached parent-died guard

**Created:** 2026-07-08
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Attached engine hot path — parent PID monitor, journal event, reconcile, and CLI fail-fast. Multi-module blast radius.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Implement FR-STAB-01 ([#163](https://github.com/beettlle/pi-spine/issues/163)): detect parent session loss in attached batch engine, journal `engine.parent_died`, reconcile orphan `running` → `failed`, and fail-fast `batch start|resume --attached` in risky shell contexts.

**Closes:** [#163](https://github.com/beettlle/pi-spine/issues/163)

**Source:** [`docs/PRD-v1.10.1-stabilization-handoff.md`](../../docs/PRD-v1.10.1-stabilization-handoff.md) §6 FR-STAB-01

**Already done (do not re-implement):** SP-518 doctor advisory, SP-534 detached policy docs, SP-315 orphan retry reconciliation.

## Dependencies

- **None**

## Context to Read First

- [`docs/PRD-v1.10.1-stabilization-handoff.md`](../../docs/PRD-v1.10.1-stabilization-handoff.md) §4–6
- [`src/batch/attached-runner.mjs`](../../src/batch/attached-runner.mjs)
- [`src/batch/attached-engine-handoff.mjs`](../../src/batch/attached-engine-handoff.mjs)
- [`src/process/liveness.mjs`](../../src/process/liveness.mjs) — `isProcessAlive`
- [`src/doctor/attached-orphan-risk.mjs`](../../src/doctor/attached-orphan-risk.mjs) — `detectAttachedOrphanRiskPatterns`
- [`src/batch/orphan-detect.mjs`](../../src/batch/orphan-detect.mjs), [`src/batch/reconcile.mjs`](../../src/batch/reconcile.mjs)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/attached-runner.mjs`
- `src/batch/attached-engine-handoff.mjs`
- `src/batch/parent-session-monitor.mjs`
- `src/batch/orphan-detect.mjs`
- `bin/spine-batch.mjs`
- `tests/batch/attached-parent-died.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/attached-parent-died.test.mjs` |
| fileScopeMustChange | `src/batch/parent-session-monitor.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read PRD FR-STAB-01 acceptance criteria and code anchors
- [ ] Trace attached engine poll loop and existing orphan reconcile paths (SP-315)

### Step 1: Parent session monitor module

- [ ] Create `src/batch/parent-session-monitor.mjs` — record `process.ppid` at startup
- [ ] Periodic check: parent PID reparented to init/unexpected, or `isProcessAlive(ppid)` false
- [ ] Export monitor start/stop hooks for attached engine integration

### Step 2: Engine integration and journal

- [ ] Wire monitor into attached engine poll loop (reuse milestone interval or dedicated interval)
- [ ] On parent death: append journal `engine.parent_died` with `{ parentPid, enginePid, signal: "parent_exit" }`
- [ ] Fail-closed reconcile: orphan `running` → `failed`; clear `enginePid`; set `phase: "paused"`

### Step 3: CLI fail-fast guard

- [ ] `batch start|resume --attached`: exit non-zero when `detectAttachedOrphanRiskPatterns` is risky
- [ ] Error text suggests detached start + `spine wait` remediation

### Step 4: Testing & Verification

- [ ] `tests/batch/attached-parent-died.test.mjs` — simulate parent PID change / dead parent without hand-editing batch-state JSON
- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 5: Documentation & Delivery

- [ ] Update operator-runbook attached recovery section — mark #163 **Closes**
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Attached engine journals `engine.parent_died` and reconciles on parent session loss
- [ ] `batch start|resume --attached` fails fast in risky shell contexts
- [ ] Regression tests pass without hand-editing batch-state JSON

## Do NOT

- Re-implement SP-518 doctor advisory or SP-534 detached policy docs
- Hand-edit `.spine/batch-state.json` in tests

## Git Commit Convention

- `feat(SP-539): attached parent-died guard and reconcile`
