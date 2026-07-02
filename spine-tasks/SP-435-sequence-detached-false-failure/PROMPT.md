# Task: SP-435 — Sequence detached false failure exit

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Sequence orchestrator exit semantics.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Do not exit sequence with failure when detached engine PID is alive and batch phase is `running`. Show log tail for **current** batch only. Continue polling through waves. Closes #72.
**Closes:** [#72](https://github.com/beettlle/pi-spine/issues/72)

## Dependencies

- **Task:** SP-388 (spine-run-sequence-cli)

## Context to Read First

- GitHub issue #72
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/sequence.mjs`
- `src/batch/detached-start.mjs`
- `tests/batch/sequence-detached-poll.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-detached-poll.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #72 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Poll semantics

- [ ] Treat alive detached engine + running phase as success-in-progress
- [ ] Filter detached log tail to current batchId

### Step 1: Tests

- [ ] Sequence does not exit 1 while engine running
- [ ] Stale batch log not shown

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #72 (`gh issue close 72`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — sequence detached monitoring

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #72 closed

## Git Commit Convention

- `feat(SP-435): complete Step N — description`
- `fix(SP-435): description`
- `hydrate: SP-435 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
