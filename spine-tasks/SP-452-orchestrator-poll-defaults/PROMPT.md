# Task: SP-452 — Orchestrator poll interval defaults

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Config + constant changes for poll intervals.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Raise default orchestrator poll intervals (attached milestone 200ms→2s, sequence wait 250ms→5s) and expose `orchestrator.*PollMs` keys in spine-config. Closes [#98](https://github.com/beettlle/pi-spine/issues/98) partial P0.
**Closes:** [#98](https://github.com/beettlle/pi-spine/issues/98) (partial)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #98
- `src/batch/attached-runner.mjs`, `src/batch/sequence.mjs`
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/attached-runner.mjs`
- `src/batch/sequence.mjs`
- `src/config/spine-config-schema.mjs`
- `templates/spine-config.json`
- `tests/batch/poll-interval-defaults.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/poll-interval-defaults.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `tests/batch/poll-interval-defaults.test.mjs` |
| artifactsMustExist | `tests/batch/poll-interval-defaults.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #98 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Defaults + config

- [ ] Change ATTACHED_MILESTONE_POLL_MS default to 2000
- [ ] Change sequence wait default to 5000ms
- [ ] Add orchestrator config keys with documented defaults

### Step 2: Tests

- [ ] Assert new defaults when config omitted
- [ ] Assert config override respected

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #98 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — poll interval mitigations

**Check If Affected:**
- `templates/spine-config.json`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-452): complete Step N — description`
- `fix(SP-452): description`
- `hydrate: SP-452 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)

- fileScopeMustChange updated from `src/batch/attached-runner.mjs` (pre-landed by SP-451) to `tests/batch/poll-interval-defaults.test.mjs` — the delivery artifact that must still be created.
