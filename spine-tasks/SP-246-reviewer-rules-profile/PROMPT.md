# Task: SP-246 — Reviewer rules profile section

**Created:** 2026-06-14
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Schema-only extension to rules profile; isolated from worker selection behavior.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Add a `reviewer` section to `.spine/rules-profile.json` schema with safe defaults so engine reviewers can auto-select Cursor rules separately from workers (FR-REV-08 foundation). Workers keep `profile.worker`; reviewers get `profile.reviewer` with worker-execution rules excluded by default.

## Dependencies

- **None**

## Context to Read First

- `src/config/cursor-rules/profile.mjs`
- `templates/rules-profile.json`
- `docs/design/cursor-rules-discovery.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/cursor-rules/profile.mjs`
- `templates/rules-profile.json`
- `tests/config/cursor-rules/profile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/config/cursor-rules/profile.mjs`, `templates/rules-profile.json` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/config/cursor-rules/profile.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read `profile.mjs` worker section patterns (`validateWorkerSection`, `mergeRulesProfile`)
- [ ] Confirm `DEFAULT_RULES_PROFILE` structure

### Step 1: Reviewer profile schema
> **Plan-review checkpoint**

- [ ] Add `RulesProfileReviewer`: `enabled`, `alwaysInclude`, `neverInclude`, `globMatch`, `maxRules`
- [ ] Defaults: `enabled: true`, `neverInclude: ["taskplane-worker-cursor.mdc", "taskplane-task-authoring.mdc"]`, `globMatch: true`, `maxRules: 32`
- [ ] `validateRulesProfile` + `mergeRulesProfile` handle `reviewer` (parallel to `worker`)
- [ ] Update `templates/rules-profile.json` with `reviewer` block
- [ ] `spine_review_step` after step

### Step 2: Tests
> **Code review checkpoint**

- [ ] Tests: defaults merge when file omits `reviewer`
- [ ] Tests: invalid `reviewer` section rejected
- [ ] Tests: `neverInclude` wins over `alwaysInclude` for reviewer paths
- [ ] `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Log reviewer profile field list in STATUS.md Discoveries for SP-247+
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-253 owns design doc)

**Check If Affected:**
- `docs/design/cursor-rules-discovery.md` — note deferred to SP-253

## Completion Criteria

- [ ] All steps complete
- [ ] Reviewer profile loads with defaults; worker profile unchanged
- [ ] Profile tests pass; full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-246): complete Step N — description`

## Do NOT

- Change `selectRulesForWorker` behavior (SP-247)
- Wire reviewer context into review spawn (SP-251)

---

## Amendments (Added During Execution)
