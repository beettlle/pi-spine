# Task: SP-265 — Extract review-shared pure helpers

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Create shared module with pure verdict/artifact helpers before wiring imports.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Create `src/batch/review-shared.mjs` with extracted pure helpers (verdict parsing, artifact paths) and unit tests. Do not rewire engine-lanes/review.mjs or review.mjs yet.

## Dependencies

- **None**

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

- `src/batch/engine-lanes/review.mjs`
- `src/batch/review.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review-shared.mjs`
- `tests/batch/review-shared.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | src/batch/review-shared.mjs |
| artifactsMustExist | src/batch/review-shared.mjs, tests/batch/review-shared.test.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Diff engine-lanes/review.mjs vs review.mjs — list duplicated pure helpers
- [ ] Baseline: `npm test -- tests/batch/engine-code-review.test.mjs`

### Step 1: Extract pure helpers
> **Plan-review checkpoint**

- [ ] Create review-shared.mjs with named exports
- [ ] Add targeted unit tests
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`
- [ ] Log extracted symbols in STATUS.md for SP-266

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

- `feat(SP-265): complete Step N — description`
- `fix(SP-265): description`
- `test(SP-265): description`

## Do NOT

- Refactor unrelated review.mjs logic outside file scope
- Skip `spine_review_step` at Level 2 checkpoints

- Wire imports in review.mjs yet (SP-266)
---

## Amendments (Added During Execution)
