# Task: SP-371 — Reviewer model settings and doctor

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Config surface + doctor; touches settings registry.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Complete **GitHub issue #53** config/CLI slice: register editable paths for `agents.reviewer.*` and per-type plan/code/final model+thinking; extend doctor to show effective per-type pins.

## Dependencies

- **Task:** SP-370 (spawn uses pins)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/settings-fields.mjs`
- `src/doctor/agent-model-inherit.mjs`
- `templates/spine-config.json`
- `tests/config/settings-fields.test.mjs`
- `tests/doctor/agent-model-inherit.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/config/settings-fields.test.mjs tests/doctor/agent-model-inherit.test.mjs` |
| fileScopeMustChange | `src/config/settings-fields.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Audit FR-CFG-03 settings-fields patterns
- [ ] List reviewer paths from issue #53

### Step 1: Settings and doctor

- [ ] Register reviewer + plan/code/final model/thinking paths
- [ ] Doctor output shows effective per-type pins and inherit warnings

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Update template spine-config with optional nested reviewer blocks

## Documentation Requirements

**Must Update:**
- `templates/spine-config.json`

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-371): complete Step N — description`
- `fix(SP-371): description`
- `test(SP-371): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
