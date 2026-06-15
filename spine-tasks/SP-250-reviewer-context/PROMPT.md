# Task: SP-250 — Reviewer context builder + journal

**Created:** 2026-06-14
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Mirrors SP-092 worker context path; journal event + byte cap; depends on selection and scope modules.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Add `buildReviewerContext()` to load selected Cursor rules into bounded system-prompt text and emit journal event `reviewer.rules_selected`. Use 16 KiB byte cap (half of worker). Degrade gracefully on profile/manifest errors — do not fail review spawn.

## Dependencies

- **Task:** SP-248 (selectRulesForReviewer)
- **Task:** SP-249 (resolveReviewScopePaths)

## Context to Read First

- `src/config/worker-context.mjs` — `loadContextDocEntries`, `emitWorkerRulesSelected`
- `src/config/cursor-rules/select.mjs`
- `src/batch/review-scope.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/reviewer-context.mjs`
- `src/config/worker-context.mjs`
- `tests/config/reviewer-context.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/config/reviewer-context.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/config/reviewer-context.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] SP-248 + SP-249 complete
- [ ] Read `buildWorkerContextAsync` and journal emission patterns

### Step 1: Reviewer context module
> **Plan-review checkpoint**

- [ ] `DEFAULT_REVIEWER_CONTEXT_BYTE_CAP = 16_384`
- [ ] `buildReviewerContext({ projectRoot, config, reviewType, scopePaths, journal })` — **sync** API
- [ ] No `.cursor/rules/` → `{ text: "", selection: { mode: "skipped" } }`
- [ ] Profile/manifest errors → degrade (empty text, journal reason)
- [ ] Reuse `loadContextDocEntries`; format `## Project standards for review`
- [ ] **No** `referenceDocs` injection
- [ ] `spine_review_step` after step

### Step 2: Journal + tests
> **Code review checkpoint**

- [ ] Journal `reviewer.rules_selected`: `reviewType`, `scopePaths`, `paths`, `capped`, `bytesUsed`, `mode`
- [ ] Tests: byte cap truncation, journal payload, missing manifest skips gracefully
- [ ] Export `loadContextDocEntries` from worker-context if needed
- [ ] `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Log journal event schema in STATUS.md for SP-251
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `src/batch/review.mjs` — SP-251 wires this module

## Completion Criteria

- [ ] All steps complete
- [ ] Reviewer context loads rules with 16 KiB cap
- [ ] Journal event emitted; graceful degradation on errors
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-250): complete Step N — description`

## Do NOT

- Wire into `runStepReview` (SP-251)
- Change worker context behavior

---

## Amendments (Added During Execution)
