# Task: SP-146 — tasks validate JSON output

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** --json, --warnings-only, and spine help tasks.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

**Replaces:** SP-125b

## Mission

Add --json TasksValidateResult output, --warnings-only mode, and spine help tasks documentation.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-145

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §6.4`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-tasks.mjs`
- `bin/spine.mjs`
- `tests/tasks/validate-cli.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-146
- [ ] Dependencies satisfied (SP-145)

### Step 1: --json output per TasksValidateResult schema

- [ ] --json output per TasksValidateResult schema

### Step 2: --warnings-only for folder name, missing STATUS, deps m

- [ ] --warnings-only for folder name, missing STATUS, deps mismatch; spine help tasks

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Review docs per Documentation Requirements
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-146

## Git Commit Convention

- `feat(SP-146): complete Step N — description`

## Do NOT

- Expand scope beyond handoff §11.1

---

## Amendments (Added During Execution)
