# Task: SP-390 — Sequence auto-approve gate safety

**Created:** 2026-06-30
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Safety gate for real-pi; issue #54 SP-E.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 1

## Mission

Implement **GitHub issue #54** Tier 2 safety: refuse `--auto-approve-gate` for real pi unless `--force`; allow with `SPINE_WORKER_STUB=1`; doctor warning.

## Dependencies

- **Task:** SP-387 (sequence core)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/sequence.mjs`
- `src/doctor/sequence-safety.mjs`
- `tests/batch/sequence-auto-approve.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-auto-approve.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `spine-tasks/SP-390-sequence-auto-approve-safety/STATUS.md` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read issue #54 auto-approve matrix

### Step 1: Safety gates

- [ ] Block auto-approve-gate without stub/force
- [ ] Add doctor check or preflight message

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

- `feat(SP-390): complete Step N — description`
- `fix(SP-390): description`
- `test(SP-390): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)

- **2026-06-30:** `src/batch/sequence.mjs` partially pre-landed on `main`. `fileScopeMustChange` targets delivery `STATUS.md`; `testCommand` verifies auto-approve safety gates.
