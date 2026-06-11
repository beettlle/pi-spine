# Task: SP-153 — Engine REPLAN and merge block

**Created:** 2026-06-11
**Size:** S

## Review Level: 3 (Full)

**Assessment:** REPLAN fail path and wave merge block.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

**Replaces:** SP-130c

## Mission

REPLAN on final: status failed, exitReason needs_replan, no .DONE; block wave merge while needs_replan present.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-152

## Context to Read First

**Tier 3:**
- `src/batch/engine-lanes.mjs`
- `test/fixtures/taskplane/FX-final-replan/**`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes.mjs`
- `tests/batch/final-verdict.test.mjs`
- `test/fixtures/taskplane/FX-final-replan/**`

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

- [ ] Read handoff §11.1 entry for SP-153
- [ ] Dependencies satisfied (SP-152)

### Step 1: REPLAN path: failed, exitReason needs_replan, journal t


> **Plan-review checkpoint**
- [ ] REPLAN path: failed, exitReason needs_replan, journal task.verdict_recorded, no .DONE

### Step 2: Block wave merge when any task has exitReason needs_rep


> **Code review checkpoint**
- [ ] Block wave merge when any task has exitReason needs_replan; FX-final-replan fixture

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-153

## Git Commit Convention

- `feat(SP-153): complete Step N — description`

## Do NOT

- Run in parallel with SP-151/152 batches

---

## Amendments (Added During Execution)
