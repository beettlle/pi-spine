# Task: SP-465 — Batch size guidance wording

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Cosmetic size-aware batch guidance message.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Make batch size guidance warning size-aware (M-only vs L-only vs mixed) without changing threshold logic ([#106](https://github.com/beettlle/pi-spine/issues/106)).
**Closes:** [#106](https://github.com/beettlle/pi-spine/issues/106)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #106
- `src/doctor/batch-size-guidance.mjs`
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/doctor/batch-size-guidance.mjs`
- `tests/doctor/batch-size-guidance.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/doctor/batch-size-guidance.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/doctor/batch-size-guidance.mjs` |
| artifactsMustExist | `tests/doctor/batch-size-guidance.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #106 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Message shapes

- [ ] Return mCount/lCount from counter
- [ ] Format M-only without implying L present

### Step 2: Tests

- [ ] M-only fixture does not contain misleading L claim
- [ ] Mixed batch shows both counts

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #106 (`gh issue close 106`)
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
- [ ] Issue #106 closed

## Git Commit Convention

- `feat(SP-465): complete Step N — description`
- `fix(SP-465): description`
- `hydrate: SP-465 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
