# Task: SP-147 — Handoff data assembly

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Data layer for handoff from reconcile and journal.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-127a

## Mission

Create src/cli/handoff.mjs data assembly: reconcileBatch, batch-state, journal tail into structured object.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-142

## Context to Read First

**Tier 3:**
- `src/batch/reconcile.mjs`
- `src/batch/journal.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/cli/handoff.mjs`
- `tests/cli/spine-handoff.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-147
- [ ] Dependencies satisfied (SP-142)

### Step 1: assembleHandoffData(projectRoot, batchId?) returning no


> **Plan-review checkpoint**
- [ ] assembleHandoffData(projectRoot, batchId?) returning normative fields

### Step 2: Idle state when no active batch


> **Code review checkpoint**
- [ ] Idle state when no active batch; unit tests for data shape

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-147

## Git Commit Convention

- `feat(SP-147): complete Step N — description`

## Do NOT

- Include secrets in output (NFR-UXB-02)

---

## Amendments (Added During Execution)
