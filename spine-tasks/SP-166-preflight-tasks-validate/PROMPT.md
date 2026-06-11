# Task: SP-166 — Preflight tasks-validate slash

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Preflight tasks-validate check and /spine-validate slash.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

**Replaces:** SP-126

## Mission

Add preflight check id tasks-validate; register /spine-validate slash delegating to spine tasks validate.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-146

## Context to Read First

**Tier 3:**
- `bin/spine-preflight.mjs`
- `extensions/spine/slash-commands.ts`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-preflight.mjs`
- `extensions/spine/slash-commands.ts`
- `tests/spine-preflight.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | see File Scope |
| fileScopeMustNotChange | — |
| minLineCoverage | 77 |
| artifactsMustExist | — |

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-166
- [ ] Dependencies satisfied (SP-146)

### Step 1: tasks-validate check with suggestedCommand spine tasks 

- [ ] tasks-validate check with suggestedCommand spine tasks validate pending

### Step 2: /spine-validate slash

- [ ] /spine-validate slash; preflight test for distinct check name

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
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-166

## Git Commit Convention

- `feat(SP-166): complete Step N — description`

## Do NOT

- Bury validate errors inside plan check

---

## Amendments (Added During Execution)
