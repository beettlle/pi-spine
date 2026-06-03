# Task: SP-076 — DRY resume: shared resume core

**Created:** 2026-06-03
**Size:** L

## Review Level: 2 (Plan + Code)

**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Extract shared validation, file-scope loading, and journal logic from `resume.mjs` (404 lines) and `resume-multi.mjs` (763 lines) into `resume-common.mjs`. Single validation path; multi-lane adds lane/worktree checks only.

## Dependencies

- **Task:** SP-075

## File Scope

- `src/batch/resume.mjs`
- `src/batch/resume-multi.mjs`
- `src/batch/resume-common.mjs` (new)
- `tests/batch/resume*.test.mjs`

## Steps

### Step 1: Extract resume-common
> **Plan-review checkpoint**
- [ ] Shared validation + file-scope load; `spine_review_step`

### Step 2: Refactor single + multi resume
> **Code review checkpoint**
- [ ] Both modules import common; no duplicate catch blocks; `spine_review_step`

### Step 3: Testing & Verification
- [ ] Resume + multi-resume tests pass; coverage ≥77% on resume modules

## Do NOT
- Change resume semantics or segment model

---

## Amendments (Added During Execution)
