# Task: SP-247 — Shared selection core refactor

**Created:** 2026-06-14
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Internal refactor of `select.mjs`; regression risk on worker selection — all existing tests must pass unchanged.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Extract shared `selectRulesFromManifest()` from `selectRulesForWorker()` without changing worker selection behavior. SP-248 will add `selectRulesForReviewer()` on the same core.

## Dependencies

- **Task:** SP-246 (reviewer profile section)

## Context to Read First

- `src/config/cursor-rules/select.mjs`
- `tests/config/cursor-rules/select.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/cursor-rules/select.mjs`
- `src/config/cursor-rules/index.mjs`
- `tests/config/cursor-rules/select.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/config/cursor-rules/select.mjs` |
| fileScopeMustNotChange | `src/batch/review.mjs`, `src/config/worker-context.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/config/cursor-rules/select.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] SP-246 complete (reviewer profile in `profile.mjs`)
- [ ] Baseline: all `select.test.mjs` tests pass

### Step 1: Extract core
> **Plan-review checkpoint**

- [ ] Internal `selectRulesFromManifest({ manifest, alwaysInclude, neverInclude, globMatch, scopePaths, standards, neverLoad, maxRules })`
- [ ] Preserve priority order, blocklists, cap, and `dropped[]` semantics
- [ ] `spine_review_step` after step

### Step 2: Rewire worker wrapper
> **Code review checkpoint**

- [ ] `selectRulesForWorker` → thin wrapper with `profile.worker` + `fileScope` as `scopePaths`
- [ ] **All existing** `select.test.mjs` tests pass without assertion changes
- [ ] Export core (or keep internal if reviewer wrapper lives same file in SP-248)
- [ ] `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Document core API shape in STATUS.md for SP-248
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `src/config/cursor-rules/index.mjs` — export if needed

## Completion Criteria

- [ ] All steps complete
- [ ] Worker selection behavior identical to pre-refactor
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-247): complete Step N — description`

## Do NOT

- Add `selectRulesForReviewer` (SP-248)
- Change worker context injection (SP-250)

---

## Amendments (Added During Execution)
