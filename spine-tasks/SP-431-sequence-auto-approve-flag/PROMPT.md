# Task: SP-431 — Sequence --auto-approve-gate CLI flag

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** CLI flag exposure; safety in SP-390.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Expose `--auto-approve-gate` in `spine run sequence` argument parsing (wired to existing SP-390 safety gates). Closes #79.
**Closes:** [#79](https://github.com/beettlle/pi-spine/issues/79)

## Dependencies

- **Task:** SP-390 (sequence-auto-approve-safety)

## Context to Read First

- GitHub issue #79
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/sequence.mjs`
- `src/cli/sequence-args.mjs`
- `tests/batch/sequence-auto-approve-flag.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-auto-approve-flag.test.mjs tests/batch/sequence-auto-approve.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #79 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: CLI flag

- [ ] Add --auto-approve-gate to parseSequenceArgs
- [ ] Wire through to land loop between waves

### Step 1: Tests + docs

- [ ] Test flag honored under stub; refused for real pi without --force
- [ ] Document in runbook

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #79 (`gh issue close 79`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — sequence auto-approve

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #79 closed

## Git Commit Convention

- `feat(SP-431): complete Step N — description`
- `fix(SP-431): description`
- `hydrate: SP-431 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
