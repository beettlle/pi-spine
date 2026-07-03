# Task: SP-462 — Contract scope base satisfied

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Idempotent fileScopeMustChange when base already has scope.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Treat `fileScopeMustChange` as satisfied when base branch already contains intended changes (no-op tasks on consumer base). Closes [#105](https://github.com/beettlle/pi-spine/issues/105) remainder.
**Closes:** [#105](https://github.com/beettlle/pi-spine/issues/105)

## Dependencies

- **Task:** SP-478 (baseline fix lands first)

## Context to Read First

- GitHub issue #105 SP-014 scenario
- `src/batch/contract-verify.mjs`
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `tests/batch/contract-base-satisfied.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-base-satisfied.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/contract-verify.mjs` |
| artifactsMustExist | `tests/batch/contract-base-satisfied.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #105 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Base satisfaction

- [ ] Compare scope paths vs merge-base and base HEAD
- [ ] Pass verify when base already satisfies scope intent

### Step 2: Tests

- [ ] Fixture: zero lane diff vs base but scope on base → contract ok

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #105 (`gh issue close 105`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — idempotent task pattern

**Check If Affected:**
- `skills/create-spine-tasks/references/contract-template.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #105 closed

## Git Commit Convention

- `feat(SP-462): complete Step N — description`
- `fix(SP-462): description`
- `hydrate: SP-462 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
