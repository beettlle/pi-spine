# Task: SP-157 — needs_replan reconcile

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Reconcile precedence and compat integration test.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-132b

## Mission

Implement reconcile precedence: needs_replan over needs_retry; blocks needs_merge and needs_integrate.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-156

## Context to Read First

**Tier 3:**
- `src/batch/reconcile.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/reconcile.mjs`
- `tests/compat/final-verdict-reconcile.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-157
- [ ] Dependencies satisfied (SP-156)

### Step 1: Detect exitReason needs_replan in reconcile


> **Plan-review checkpoint**
- [ ] Detect exitReason needs_replan in reconcile

### Step 2: Precedence rules §9.2


> **Code review checkpoint**
- [ ] Precedence rules §9.2; integration test REPLAN → needs_replan diagnosis

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-157

## Git Commit Convention

- `feat(SP-157): complete Step N — description`

## Do NOT

- Change plain needs_retry for non-replan failures

---

## Amendments (Added During Execution)
