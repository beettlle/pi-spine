# Task: SP-458 — Flutter lane analyzer hygiene

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Contract verify / worktree hygiene for Flutter analyze pollution.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Prevent `flutter analyze` failures in lane worktrees from `build/SourcePackages` pollution — worktree setup clean or scoped analyze in contract path ([#78](https://github.com/beettlle/pi-spine/issues/78)).
**Closes:** [#78](https://github.com/beettlle/pi-spine/issues/78)

## Dependencies

- **Task:** SP-438 (adoption docs land first)

## Context to Read First

- GitHub issue #78
- `src/batch/worktree-setup.mjs`, contract verify paths
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lane-dirty-check.mjs`
- `src/batch/contract-verify.mjs`
- `tests/batch/flutter-analyzer-hygiene.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/flutter-analyzer-hygiene.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/lane-dirty-check.mjs` |
| artifactsMustExist | `tests/batch/flutter-analyzer-hygiene.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #78 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Hygiene hook

- [ ] Optional worktreeSetupHook template rm -rf build before verify
- [ ] Or document scoped analyze in PROMPT contract

### Step 2: Engine support

- [ ] Detect analyze+test compound testCommand; clean build/ when configured

### Step 3: Tests

- [ ] Fixture: polluted build/ does not fail verify after hygiene

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #78 (`gh issue close 78`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — Flutter analyzer hygiene

**Check If Affected:**
- `spine-tasks/SP-438-flutter-worktree-adoption-docs/PROMPT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #78 closed

## Git Commit Convention

- `feat(SP-458): complete Step N — description`
- `fix(SP-458): description`
- `hydrate: SP-458 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
