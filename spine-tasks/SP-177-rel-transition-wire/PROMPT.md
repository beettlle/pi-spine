# Task: SP-177 — Wire atomic transitions

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Phase 22 reliability epic (SP-REL-007).
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Wire retry/resume success paths to recordTaskTransition; regression SP-120.

**Source:** [docs/PRD-v2.1-reliability-handoff.md](../../docs/PRD-v2.1-reliability-handoff.md)

## Dependencies

- **Task:** SP-176

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.1-reliability-handoff.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/retry.mjs`
- `src/batch/engine-lanes.mjs`
- `tests/batch/retry-state-drift.test.mjs`

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

- [ ] Read handoff entry for SP-177
- [ ] Dependencies satisfied

### Step 1: Implement

- [ ] Deliver mission scope for SP-177

### Step 2: Testing & Verification

- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% on in-scope changed code
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update docs per scope
- [ ] Create `.DONE` when complete

## Completion Criteria

- [ ] All steps complete
- [ ] Handoff §4 acceptance for SP-177

## Git Commit Convention

- `feat(SP-177): complete Step N — description`

## Do NOT

- Expand scope beyond File Scope without replan
