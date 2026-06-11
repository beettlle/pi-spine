# Task: SP-165 — Adoption smoke Phase 20

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Extend adoption-smoke.sh and integration tests.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-139b

## Mission

Extend scripts/adoption-smoke.sh with spine tasks validate before batch; integration test REPLAN → needs_replan.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-166
- **Task:** SP-157
- **Task:** SP-169

## Context to Read First

**Tier 3:**
- `scripts/adoption-smoke.sh`
- `tests/adoption/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `scripts/adoption-smoke.sh`
- `tests/adoption/**`

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

- [ ] Read handoff §11.1 entry for SP-165
- [ ] Dependencies satisfied (SP-166, SP-157, SP-169)

### Step 1: adoption-smoke: spine tasks validate before batch start


> **Plan-review checkpoint**
- [ ] adoption-smoke: spine tasks validate before batch start

### Step 2: Integration test: REPLAN → needs_replan diagnosis


> **Code review checkpoint**
- [ ] Integration test: REPLAN → needs_replan diagnosis

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
- `docs/adoption/bootstrap-checklist.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-165

## Git Commit Convention

- `feat(SP-165): complete Step N — description`

## Do NOT

- Expand scope beyond handoff §11.1

---

## Amendments (Added During Execution)
