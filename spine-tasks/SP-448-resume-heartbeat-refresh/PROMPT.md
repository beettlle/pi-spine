# Task: SP-448 — Resume lane heartbeat refresh

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Resume handoff hygiene; prevents false stale lanes after `resume --force`.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

On `spine batch resume` (especially `--force`), refresh lane `lastHeartbeatAt` from `resilience.engineStartedAt` or reset stall clock so dashboard does not show lanes stale for hours while engine is alive. Part of [#100](https://github.com/beettlle/pi-spine/issues/100) fix (bullet 4 of 4).

## Dependencies

- **None**

## Context to Read First

- GitHub issue [#100](https://github.com/beettlle/pi-spine/issues/100) (heartbeat predate engineStartedAt)
- `src/batch/resume.mjs`
- `src/batch/resume-multi-lanes.mjs`
- `src/batch/state.mjs`
- `src/dashboard/snapshot.mjs` — `heartbeatAgeSeconds`, stale lane logic

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume.mjs`
- `src/batch/resume-multi-lanes.mjs`
- `src/batch/state.mjs`
- `tests/batch/resume-heartbeat-refresh.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/resume-heartbeat-refresh.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read #100 repro: lane heartbeats from pre-resume engine, `engineStartedAt` newer
- [ ] Confirm stall timeout config (`lanes.stallTimeoutMinutes`)

### Step 1: Heartbeat refresh on resume

- [ ] On successful resume handoff, set lane `lastHeartbeatAt` to `engineStartedAt` (or now) for active lanes
- [ ] Journal event optional: `lane.heartbeat_refreshed` on resume
- [ ] Do not mask true worker stalls after workers spawn (only resume boundary)

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook resume section
- [ ] Update `spine-tasks/CONTEXT.md`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — resume heartbeat / stale lane after force resume

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Resume fixture: heartbeats not stale immediately after `resume --force`

## Git Commit Convention

- `feat(SP-448): complete Step N — description`
- `fix(SP-448): description`

## Do NOT

- Close issue #100 (SP-447 closes)
- Change diagnosis rules (SP-446)

---

## Amendments (Added During Execution)
