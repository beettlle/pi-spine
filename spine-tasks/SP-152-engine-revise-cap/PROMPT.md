# Task: SP-152 — Engine REVISE cap

**Created:** 2026-06-11
**Size:** S

## Review Level: 3 (Full)

**Assessment:** REVISE retry loop and review.exhausted cap.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

**Replaces:** SP-130b

## Mission

Implement REVISE on final: increment finalAttempt, re-invoke; cap at maxFinalAttempts → review_exhausted.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-151

## Context to Read First

**Tier 3:**
- `src/batch/engine-lanes.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes.mjs`
- `tests/batch/final-verdict.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-152
- [ ] Dependencies satisfied (SP-151)

### Step 1: REVISE loop with finalAttempt counter


> **Plan-review checkpoint**
- [ ] REVISE loop with finalAttempt counter

### Step 2: On cap: task failed, exitReason review_exhausted, journ


> **Code review checkpoint**
- [ ] On cap: task failed, exitReason review_exhausted, journal review.exhausted

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-152

## Git Commit Convention

- `feat(SP-152): complete Step N — description`

## Do NOT

- Implement REPLAN path yet (SP-153)

---

## Amendments (Added During Execution)
