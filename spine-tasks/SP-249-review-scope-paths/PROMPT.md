# Task: SP-249 — Review scope path resolver

**Created:** 2026-06-14
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** New isolated module; git diff scope for code review without touching selection or spawn paths.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement `resolveReviewScopePaths()` so reviewer Cursor rule glob matching uses review-type-specific scope: PROMPT File Scope for plan reviews, `git diff` changed paths for code reviews, and empty scope for final reviews (always-only rules).

## Dependencies

- **None**

## Context to Read First

- `src/batch/review.mjs` — `buildReviewRequest` diff commands
- `src/tasks/packet/parse-prompt.mjs` — File Scope parsing

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review-scope.mjs`
- `tests/batch/review-scope.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/batch/review-scope.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/review-scope.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm `parsePrompt` File Scope API
- [ ] Confirm baseline commit threading in code review path

### Step 1: Scope resolver
> **Plan-review checkpoint**

- [ ] `resolveReviewScopePaths({ worktreePath, baseline, reviewType, taskFolder })`
- [ ] `plan` → PROMPT File Scope paths
- [ ] `code` → `git diff --name-only ${baseline}..HEAD` (fallback: `git diff --name-only`)
- [ ] `final` → `[]` (no glob activation)
- [ ] Filter noise: `.reviews/**`, `.DONE`, `.spine/runtime/**`
- [ ] `spine_review_step` after step

### Step 2: Tests
> **Code review checkpoint**

- [ ] Unit tests for each review type (mock git output or fixture worktree)
- [ ] Noise path filtering verified
- [ ] `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Export shape documented in STATUS.md for SP-250/252
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/design/cursor-rules-discovery.md` — SP-253

## Completion Criteria

- [ ] All steps complete
- [ ] Scope resolver returns correct paths per review type
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-249): complete Step N — description`

## Do NOT

- Change `select.mjs` (SP-248)
- Wire into `runStepReview` (SP-251)

---

## Amendments (Added During Execution)
