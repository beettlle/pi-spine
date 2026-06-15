# Task: SP-248 — selectRulesForReviewer

**Created:** 2026-06-14
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** New selection API on shared core; reviewer-specific exclusions and empty scope for final reviews.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement `selectRulesForReviewer()` using `profile.reviewer` and caller-supplied `scopePaths`. Honor `enabled: false`, exclude worker execution rules, append `config.standards`, and respect `neverLoad`.

## Dependencies

- **Task:** SP-247 (shared selection core)

## Context to Read First

- `src/config/cursor-rules/select.mjs`
- `src/config/cursor-rules/profile.mjs`
- `tests/config/cursor-rules/select.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/cursor-rules/select.mjs`
- `src/config/cursor-rules/index.mjs`
- `tests/config/cursor-rules/select-reviewer.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/config/cursor-rules/select.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/config/cursor-rules/select-reviewer.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] SP-247 complete (`selectRulesFromManifest` available)
- [ ] Reviewer profile defaults from SP-246

### Step 1: Reviewer selection API
> **Plan-review checkpoint**

- [ ] `selectRulesForReviewer({ manifest, profile, scopePaths, standards, neverLoad })`
- [ ] Uses `profile.reviewer.*`; returns empty when `enabled: false`
- [ ] `config.standards` append semantics (same as worker)
- [ ] `spine_review_step` after step

### Step 2: Tests
> **Code review checkpoint**

- [ ] `taskplane-worker-cursor.mdc` never selected
- [ ] `spineClass: always` rules selected without scope
- [ ] Glob rules activate on `src/foo.mjs` in scopePaths; not on empty `final` scope
- [ ] `neverLoad` blocklist honored
- [ ] `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Export from `index.mjs`; log selection shape in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `src/cli/rules.mjs` — SP-252

## Completion Criteria

- [ ] All steps complete
- [ ] Reviewer selection tests pass
- [ ] Worker selection tests still pass (regression)
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-248): complete Step N — description`

## Do NOT

- Build reviewer context or load file contents (SP-250)
- Wire review spawn (SP-251)

---

## Amendments (Added During Execution)
