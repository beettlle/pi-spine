# Task: SP-159 — Batch metrics writer

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** appendBatchMetric and lifecycle hook.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

**Replaces:** SP-134b

## Mission

Add appendBatchMetric on batch terminal in lifecycle.mjs.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-158

## Context to Read First

**Tier 3:**
- `src/batch/lifecycle.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/metrics.mjs`
- `src/batch/lifecycle.mjs`
- `tests/batch/run-metrics.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-159
- [ ] Dependencies satisfied (SP-158)

### Step 1: appendBatchMetric per BatchMetricRecord schema

- [ ] appendBatchMetric per BatchMetricRecord schema

### Step 2: Hook on batch completed/dismissed/aborted/failed

- [ ] Hook on batch completed/dismissed/aborted/failed

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-159

## Git Commit Convention

- `feat(SP-159): complete Step N — description`

## Do NOT

- Expand scope beyond handoff §11.1

---

## Amendments (Added During Execution)
