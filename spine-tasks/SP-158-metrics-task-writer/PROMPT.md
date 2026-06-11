# Task: SP-158 — Task metrics writer

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** appendTaskMetric JSONL writer.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-134a

## Mission

Create src/batch/metrics.mjs with appendTaskMetric; hook on task terminal outcomes in engine-lanes.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-153

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §6.5`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/metrics.mjs`
- `src/batch/engine-lanes.mjs`
- `tests/batch/run-metrics.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-158
- [ ] Dependencies satisfied (SP-153)

### Step 1: appendTaskMetric per TaskMetricRecord schema


> **Plan-review checkpoint**
- [ ] appendTaskMetric per TaskMetricRecord schema

### Step 2: Hook on completed/failed/skipped


> **Code review checkpoint**
- [ ] Hook on completed/failed/skipped; respect metrics.enabled; no secrets

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-158

## Git Commit Convention

- `feat(SP-158): complete Step N — description`

## Do NOT

- Log prompt text

---

## Amendments (Added During Execution)
