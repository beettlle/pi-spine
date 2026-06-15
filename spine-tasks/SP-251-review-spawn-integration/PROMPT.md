# Task: SP-251 — Review spawn rules injection

**Created:** 2026-06-14
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Thin integration in `runStepReview`; threads scope + context into reviewer system prompt before `spawnReviewerPi`.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Wire `buildReviewerContext()` into engine review spawn so code/plan/final reviewers receive auto-selected project standards in the **system prompt** (not the user review request). Stub review path unchanged.

## Dependencies

- **Task:** SP-250 (reviewer context builder)

## Context to Read First

- `src/batch/review.mjs` — `runStepReview`, `spawnReviewerPi`
- `src/config/reviewer-context.mjs`
- `src/batch/review-scope.mjs`
- `templates/agents/reviewer.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review.mjs`
- `templates/agents/reviewer.md`
- `tests/batch/review-reviewer-rules.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/batch/review.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/review-reviewer-rules.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] SP-250 complete (`buildReviewerContext` exported)
- [ ] Read `spawnReviewerPi` system prompt assembly

### Step 1: Wire review spawn
> **Plan-review checkpoint**

- [ ] Before `spawnReviewerPi`: `resolveReviewScopePaths` + `buildReviewerContext`
- [ ] Append rules text to `systemPrompt` after `loadReviewerPrompt`
- [ ] Pass `baseline`, `journal.projectRoot`, `reviewType`, `config`
- [ ] `SPINE_REVIEW_STUB=1` path unchanged — no rules injection in stub mode
- [ ] `spine_review_step` after step

### Step 2: Reviewer template + tests
> **Code review checkpoint**

- [ ] `reviewer.md`: short note — injected standards binding for REVISE
- [ ] Test: assert rules block in system prompt when manifest exists (mock spawn or extracted helper)
- [ ] Do **not** inject into `buildReviewRequest` user prompt
- [ ] `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Integration notes in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-253 owns PRD/design)

**Check If Affected:**
- `docs/design/cursor-rules-discovery.md` — SP-253

## Completion Criteria

- [ ] All steps complete
- [ ] Engine review spawn includes standards in system prompt when rules exist
- [ ] Stub path unchanged
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-251): complete Step N — description`

## Do NOT

- Change worker prompt paths
- Make `runStepReview` async unless strictly required

---

## Amendments (Added During Execution)
