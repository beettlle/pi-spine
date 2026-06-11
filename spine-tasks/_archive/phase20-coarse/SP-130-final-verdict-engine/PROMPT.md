# Task: SP-130 — Final verdict engine loop

**Created:** 2026-06-11
**Size:** L

## Review Level: 3 (Full)

**Assessment:** Engine integration — highest risk Phase 20 task; REVISE cap and merge block.
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 2

## Canonical Task Folder

```
spine-tasks/SP-130-final-verdict-engine/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Integrate final review loop in engine-lanes.mjs: REVISE retry cap, REPLAN fail path, Review Level 0 skip, wave merge block on needs_replan.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-129

## Context to Read First

**Tier 3:**
- `src/batch/engine-lanes.mjs`
- `docs/PRD-v2.0-implementation-handoff.md §8`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes.mjs`
- `tests/batch/final-verdict.test.mjs`
- `test/fixtures/taskplane/FX-final-replan/**`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-129)

### Step 1: Final review phase after steps when requireFinalVerdict && r


> **Plan-review checkpoint**
- [ ] Final review phase after steps when requireFinalVerdict && reviewLevel >= 1

### Step 2: REVISE: increment finalAttempt

- [ ] REVISE: increment finalAttempt; cap at maxFinalAttempts → review_exhausted

### Step 3: REPLAN: failed + exitReason needs_replan

- [ ] REPLAN: failed + exitReason needs_replan; journal task.verdict_recorded; no .DONE

### Step 4: Block wave merge while needs_replan present


> **Code review checkpoint**
- [ ] Block wave merge while needs_replan present

### Step 5: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Fix all failures

### Step 6: Documentation & Delivery

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
- [ ] Acceptance criteria in handoff doc satisfied for SP-130

## Git Commit Convention

- `feat(SP-130): complete Step N — description`
- `fix(SP-130): description`

## Do NOT

- Weaken existing step review flow

---

## Amendments (Added During Execution)
