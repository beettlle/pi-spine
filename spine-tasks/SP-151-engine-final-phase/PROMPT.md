# Task: SP-151 — Engine final review phase

**Created:** 2026-06-11
**Size:** S

## Review Level: 3 (Full)

**Assessment:** Engine enters final-review phase after steps complete.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

**Replaces:** SP-130a

## Mission

Integrate final-review phase gate in engine-lanes.mjs when requireFinalVerdict && reviewLevel ≥ 1.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-150

## Context to Read First

**Tier 3:**
- `src/batch/engine-lanes.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes.mjs`
- `tests/batch/final-verdict.test.mjs`

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

- [ ] Read handoff §11.1 entry for SP-151
- [ ] Dependencies satisfied (SP-150)

### Step 1: Enter final review phase after all steps complete (befo


> **Plan-review checkpoint**
- [ ] Enter final review phase after all steps complete (before .DONE)

### Step 2: Skip final when reviewLevel 0


> **Code review checkpoint**
- [ ] Skip final when reviewLevel 0; journal task.verdict_recorded on verdict

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-151

## Git Commit Convention

- `feat(SP-151): complete Step N — description`

## Do NOT

- Implement REVISE cap or REPLAN yet

---

## Amendments (Added During Execution)
