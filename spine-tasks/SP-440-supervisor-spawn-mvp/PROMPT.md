# Task: SP-440 — Supervisor spawn MVP

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** New batch subprocess; opt-in config.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

FR-SHIP-11 Tier 1 (#71 slice A–E): opt-in `agents.supervisor.enabled`, spawn supervisor Pi session on detached batch start, poll reconcile on interval, journal supervisor.started/observation/stopped/nudge events, kill on batch terminal. Default enabled:false.
**GitHub:** [#71](https://github.com/beettlle/pi-spine/issues/71) (partial)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #71
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/supervisor-spawn.mjs`
- `src/batch/detached-start.mjs`
- `src/batch/lifecycle.mjs`
- `templates/agents/supervisor.md`
- `tests/batch/supervisor-spawn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/supervisor-spawn.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #71 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Spawn lifecycle

- [ ] Create supervisor-spawn.mjs (spawn/kill, journal events)
- [ ] Wire into detached batch start behind enabled flag

### Step 1: Agent template

- [ ] Update templates/agents/supervisor.md with poll-loop standing orders

### Step 2: Tests

- [ ] enabled:true → supervisor.started; terminal → supervisor.stopped
- [ ] enabled:false → no events

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — supervisor opt-in (interim)

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-440): complete Step N — description`
- `fix(SP-440): description`
- `hydrate: SP-440 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
