# Task: SP-476 — Integrate config and doctor warnings

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** #91 slice 2a; split from SP-443.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Add `integrate.isolatedWorktree` and `integrate.allowHumanOnBaseBranch` config defaults; doctor warns when active batch + human on baseBranch ([#91](https://github.com/beettlle/pi-spine/issues/91) partial). Split from SP-443.

## Dependencies

- **Task:** SP-475

## Context to Read First

- GitHub issue #91
- `templates/spine-config.json`, `spine-preflight-lib.mjs`
- Parent split: SP-443
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/spine-config.json`
- `src/config/spine-preflight-lib.mjs`
- `src/doctor/run-doctor-checks.mjs`
- `tests/doctor/integrate-concurrent-dev.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/doctor/integrate-concurrent-dev.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `templates/spine-config.json` |
| artifactsMustExist | `tests/doctor/integrate-concurrent-dev.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #91 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Config + doctor

- [ ] Add integrate.* config defaults to spine-config template
- [ ] Doctor warns active batch + human on baseBranch

### Step 2: Tests

- [ ] Doctor emits concurrent-dev warning when configured

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #91 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-476): complete Step N — description`
- `fix(SP-476): description`
- `hydrate: SP-476 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
