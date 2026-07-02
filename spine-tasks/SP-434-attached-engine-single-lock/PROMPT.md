# Task: SP-434 — Attached engine single-owner lock

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Concurrency safety on attached batches.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Reject second `--attached` start/resume when engine PID alive for same batch (unless explicit orphan handoff with journal event). Prevent sequence wave + resume collision. Closes #89.
**Closes:** [#89](https://github.com/beettlle/pi-spine/issues/89)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #89
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/attached-runner.mjs`
- `src/batch/detached-start.mjs`
- `src/batch/resume.mjs`
- `tests/batch/attached-engine-lock.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/attached-engine-lock.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #89 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Lock check

- [ ] Store/check resilience.enginePid before attached spawn
- [ ] Fail fast with clear error when PID alive

### Step 1: Handoff path

- [ ] Optional --force orphans prior engine with journal event

### Step 2: Regression

- [ ] Test: attached start → attached resume → expect fail-fast or clean handoff

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #89 (`gh issue close 89`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — single attached engine

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #89 closed

## Git Commit Convention

- `feat(SP-434): complete Step N — description`
- `fix(SP-434): description`
- `hydrate: SP-434 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
