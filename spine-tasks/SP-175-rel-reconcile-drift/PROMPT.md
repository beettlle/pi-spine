# Task: SP-175 — Reconcile state drift

**Created:** 2026-06-11
**Size:** S

## Review Level: 3 (Full)

**Assessment:** Phase 22 reliability epic (SP-REL-005).
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Add detectBatchStateDrift() and state_drift diagnosis in reconcile.

**Source:** [docs/PRD-v2.1-reliability-handoff.md](../../docs/PRD-v2.1-reliability-handoff.md)

## Dependencies

- **Task:** SP-174

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.1-reliability-handoff.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/reconcile.mjs`
- `src/batch/diagnosis.mjs`
- `tests/batch/journal-rebuild.test.mjs`

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

- [ ] Read handoff entry for SP-175
- [ ] Dependencies satisfied

### Step 1: Implement

- [ ] Deliver mission scope for SP-175

### Step 2: Testing & Verification

- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% on in-scope changed code
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update docs per scope
- [ ] Create `.DONE` when complete

## Completion Criteria

- [ ] All steps complete
- [ ] Handoff §4 acceptance for SP-175

## Git Commit Convention

- `feat(SP-175): complete Step N — description`

## Do NOT

- Expand scope beyond File Scope without replan
