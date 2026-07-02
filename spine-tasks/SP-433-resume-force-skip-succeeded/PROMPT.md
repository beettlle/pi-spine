# Task: SP-433 — Resume force skip succeeded tasks

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Resume replay bug; collateral task regression.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

On `resume --force`, skip tasks/segments already terminal-success in journal+batch-state — do not re-run contract/review for unrelated succeeded lanes. Closes #88.
**Closes:** [#88](https://github.com/beettlle/pi-spine/issues/88)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #88
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume-multi.mjs`
- `src/batch/resume-engine.mjs`
- `tests/batch/resume-skip-succeeded.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/resume-skip-succeeded.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #88 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Skip logic

- [ ] Detect terminal success from journal (task.completed, lane.committed, .DONE)
- [ ] Restrict forced replay to retried/failed/pending segments only

### Step 1: Regression

- [ ] Multi-lane batch: one failed → retry → resume must not review.start succeeded IDs

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #88 (`gh issue close 88`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — resume --force semantics

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #88 closed

## Git Commit Convention

- `feat(SP-433): complete Step N — description`
- `fix(SP-433): description`
- `hydrate: SP-433 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
