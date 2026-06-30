# Task: SP-388 — spine run sequence CLI

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CLI wiring for sequence runner.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Wire **GitHub issue #54** Tier 2 CLI: `spine run sequence pending` with flags `--from-wave`, `--through-wave`, `--attached`, `--stop-on-failure`, `--json`, `--dry-run`.

## Dependencies

- **Task:** SP-387 (sequence.mjs core)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-run.mjs`
- `bin/spine.mjs`
- `src/cli/sequence.mjs`
- `tests/cli/sequence.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/sequence.test.mjs` |
| fileScopeMustChange | `src/cli/sequence.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/cli/sequence.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Resolve command naming: spine run sequence vs batch sequence (pick one, document)

### Step 1: CLI wiring

- [ ] Add sequence subcommand and flag parsing
- [ ] Integration test with stub sequence fixture

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery



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

- `feat(SP-388): complete Step N — description`
- `fix(SP-388): description`
- `test(SP-388): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
