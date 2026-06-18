# Task: SP-295 — Early artifact honor delivery

**Created:** 2026-06-18
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Fixture tests, runbook, and issue close for SP-282 / #5.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Closes:** [#5](https://github.com/beettlle/pi-spine/issues/5)

## Mission

Complete delivery slice for early-artifact honor (parent SP-282).

Add fixture test from batch `20260618T000943`, update operator runbook, close GitHub issue #5.

## Dependencies

- **Task:** SP-294

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

- `spine-tasks/SP-294-early-artifact-honor-core/PROMPT.md`
- `tests/batch/review-spawn-timeout-recovery.test.mjs`
- `tests/batch/engine-final-review-timeout.test.mjs`
- `.spine/runtime/20260618T000943/archive/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/reviewer-artifact-early-honor.test.mjs`
- `tests/batch/review-spawn-timeout-recovery.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | tests/batch/reviewer-artifact-early-honor.test.mjs, docs/adoption/operator-runbook.md |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/reviewer-artifact-early-honor.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-294 core honor merged

### Step 1: Tests and runbook

- [ ] `reviewer-artifact-early-honor.test.mjs`: hung spawn + on-disk APPROVE → seconds not 90m
- [ ] Runbook entry for hung reviewer with artifact on disk

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Close GitHub issue #5: `gh issue close 5 --comment "Fixed in SP-282/SP-295: engine honors on-disk reviewer artifact and kills hung pi without waiting full stall timeout."`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #5 closed with comment referencing SP-295
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-295): complete Step N — description`
- `fix(SP-295): description`
- `test(SP-295): description`

## Do NOT

- Re-implement core honor loop (belongs in SP-294)
---

## Amendments (Added During Execution)
