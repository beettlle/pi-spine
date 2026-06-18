# Task: SP-297 — Engine orphan resume delivery

**Created:** 2026-06-18
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Regression test, diagnosis/runbook, issue close for SP-284 / #7.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Closes:** [#7](https://github.com/beettlle/pi-spine/issues/7)

## Mission

Complete delivery slice for engine orphan resume (parent SP-284).

Add `engine-orphan-resume.test.mjs`, update diagnosis messaging and runbook, close GitHub issue #7.

## Dependencies

- **Task:** SP-296

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

- `spine-tasks/SP-296-engine-orphan-resume-core/PROMPT.md`
- `tests/batch/resume-engine-crash.test.mjs`
- `.spine/runtime/20260618T191236/archive/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/engine-orphan-resume.test.mjs`
- `src/batch/diagnosis.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | tests/batch/engine-orphan-resume.test.mjs, docs/adoption/operator-runbook.md |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/engine-orphan-resume.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-296 core resume merged

### Step 1: Tests and runbook

- [ ] `engine-orphan-resume.test.mjs`: dead engine + running phase → resume without pause
- [ ] Runbook: ENGINE ORPHANED → resume (no pause step)

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Close GitHub issue #7: `gh issue close 7 --comment "Fixed in SP-284/SP-297: dead engine resume no longer requires manual pause when phase is running."`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `src/batch/diagnosis.mjs`

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #7 closed with comment referencing SP-297
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-297): complete Step N — description`
- `fix(SP-297): description`
- `test(SP-297): description`

## Do NOT

- Re-implement validate.mjs fix (belongs in SP-296)
---

## Amendments (Added During Execution)
