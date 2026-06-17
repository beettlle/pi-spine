# Task: SP-266 — Wire review dedup imports

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Rewire both review files to use review-shared; behavior must stay identical.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Update `src/batch/engine-lanes/review.mjs` and `src/batch/review.mjs` to import from `review-shared.mjs` and remove duplicated blocks. No behavior change.

## Dependencies

- **Task:** SP-265

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

- `src/batch/review-shared.mjs`
- `spine-tasks/SP-258-dedupe-engine-lanes-review/PROMPT.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/review.mjs`
- `src/batch/review.mjs`
- `tests/batch/engine-code-review.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | src/batch/engine-lanes/review.mjs, src/batch/review.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-265 complete (review-shared.mjs exists)
- [ ] Baseline engine-code-review tests green

### Step 1: Rewire imports
> **Code review checkpoint**

- [ ] Update both review files to import shared helpers
- [ ] Remove duplicate blocks ≥30 lines for extracted concerns
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Log discoveries in STATUS.md if needed
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

- `feat(SP-266): complete Step N — description`
- `fix(SP-266): description`
- `test(SP-266): description`

## Do NOT

- Refactor unrelated review.mjs logic outside file scope
- Skip `spine_review_step` at Level 2 checkpoints

- Extract spawn logic (SP-267)
---

## Amendments (Added During Execution)
