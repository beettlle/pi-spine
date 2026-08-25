# Task: SP-730 — Extract review-plan.mjs; thin coordinator; close #262

**Created:** 2026-08-25
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Final #262 slice; LOC ≤500 per module.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #262 — Extract `runPlanReviewPhase` into `review-plan.mjs`. Make `review.mjs` a thin coordinator re-exporting phase entrypoints. No single review module exceeds 500 LOC. Arch import-cycles must not grow.

## Dependencies

- **Task:** SP-729 (code/final extract complete)

## Context to Read First

- `src/batch/engine-lanes/review.mjs`
- `src/batch/engine-lanes/review-code.mjs`
- `src/batch/engine-lanes/review-final.mjs`
- `tests/arch/import-cycles.test.mjs`
- GitHub #262
- Parent split: SP-262 — plan + coordinator closes epic

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/review-plan.mjs`
- `src/batch/engine-lanes/review.mjs`
- `tests/batch/final-verdict.test.mjs`
- `tests/arch/import-cycles.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/final-verdict.test.mjs tests/arch/import-cycles.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/review-plan.mjs` |

## Steps

### Step 1: Plan extract + thin coordinator

- [ ] Move runPlanReviewPhase to review-plan.mjs
- [ ] Thin review.mjs re-exports phase entrypoints
- [ ] Verify no review module > 500 LOC; ALLOWED_CLUSTER_CYCLES does not grow

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- Module architecture notes if any document review.mjs monolith

## Completion Criteria

- [ ] No review module > 500 LOC
- [ ] Closes #262
- [ ] Import cycles do not grow
- [ ] `.DONE` created

## Do NOT

- Rewrite review semantics or diagnosis taxonomy
- Break #267 import cycle in this task (deferred)
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `refactor(SP-730): extract review-plan; thin coordinator (#262)`
