# Task: SP-333 — Adoption smoke recipe and registry docs

**Created:** 2026-06-20
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only task: register adoption-smoke scenario and document registry in operator runbook and bootstrap checklist.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Register adoption-smoke scenario and document scenario registry for operators.

Update docs/adoption/operator-runbook.md and docs/adoption/bootstrap-checklist.md.

## Dependencies

1. **Task:** SP-332

## Context to Read First

- `docs/adoption/operator-runbook.md`
- `docs/adoption/bootstrap-checklist.md`
- `tests/fixtures/scenarios/registry.json`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `tests/fixtures/scenarios/registry.json`
- `docs/adoption/operator-runbook.md`
- `docs/adoption/bootstrap-checklist.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| minLineCoverage | 77 |
| artifactsMustExist | `(none beyond tests)` |

## Steps

### Step 0: Preflight

- [ ] Review SP-332 CLI output format
- [ ] Review adoption-smoke.sh script

### Step 1: Register adoption-smoke and write docs

- [ ] Add adoption-smoke registry entry
- [ ] Write operator-runbook scenario registry section
- [ ] Update bootstrap-checklist

### Step 2: Testing & Verification

- [ ] Run FULL test suite: npm run typecheck && SPINE_WORKER_STUB=1 npm test

### Step 3: Documentation & Delivery

- [ ] Create .DONE

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md`
- `docs/adoption/bootstrap-checklist.md`

**Check If Affected:**

- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] adoption-smoke scenario registered
- [ ] Operator docs updated
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-333): complete Step N — description`
- `fix(SP-333): description`
- `test(SP-333): description`

## Do NOT

- Change CLI implementation
- Add new markdown files beyond listed docs

---

## Amendments (Added During Execution)
