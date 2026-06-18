# Task: SP-294 — Early artifact honor core

**Created:** 2026-06-18
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Review spawn wait loop — poll on-disk artifact and kill hung pi without full stall timeout.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement core early-artifact honor for engine reviewer spawn (parent SP-282, issue #5).

**Required behavior:**
1. While awaiting reviewer `pi` exit, poll for terminal on-disk review artifact (APPROVE/PASS/REVISE/REPLAN) on bounded interval with mtime quiescence.
2. When artifact is valid, journal `review.completed` with `honorReason: artifact_ready`, terminate hung child.
3. Final review: honor only when contract verification already passed (same guard as `honorReviewSpawnFailureWhenEligible`).
4. Preserve SP-279 timeout backstop when no artifact appears.

## Dependencies

- **Task:** SP-285

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

```bash
spine settings set agents.worker.model cursor/auto
spine settings set agents.reviewer.model google/gemini-3.1-pro-preview
```

## Context to Read First

- `spine-tasks/SP-282-reviewer-artifact-early-honor/PROMPT.md`
- `src/batch/review.mjs`
- `src/batch/review-spawn.mjs`
- `src/batch/task-stall-budget.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review.mjs`
- `src/batch/review-spawn.mjs`
- `src/batch/task-stall-budget.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/batch/review.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read SP-282 parent mission and issue #5 timeline
- [ ] Confirm SP-285 nested-spawn env fix merged

### Step 1: Early artifact honor loop

> **Plan-review checkpoint**

- [ ] Poll artifact path during reviewer wait
- [ ] Honor terminal verdict + kill hung pi
- [ ] Final-review contract guard preserved

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-294): complete Step N — description`
- `fix(SP-294): description`
- `test(SP-294): description`

## Do NOT

- Honor partial/invalid artifacts
- Skip contract verification on final reviews
- Close GitHub issue in this slice (SP-295 delivery)
---

## Amendments (Added During Execution)
