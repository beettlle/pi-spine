# Task: SP-252 — CLI reviewer rules preview

**Created:** 2026-06-14
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CLI extension only; mirrors existing `spine rules select --task` for reviewer role.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Extend `spine rules select` so operators can preview reviewer rule selection before batch: `--role reviewer --review-type plan|code|final` with optional `--baseline` for code scope.

## Dependencies

- **Task:** SP-248 (selectRulesForReviewer)
- **Task:** SP-249 (resolveReviewScopePaths)

## Context to Read First

- `src/cli/rules.mjs`
- `tests/cli/spine-rules.test.mjs`
- `src/batch/review-scope.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/cli/rules.mjs`
- `bin/spine-rules.mjs`
- `tests/cli/spine-rules.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/cli/rules.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/cli/spine-rules.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] SP-248 + SP-249 complete
- [ ] Read existing `runRulesSelect` worker path

### Step 1: CLI flags
> **Plan-review checkpoint**

- [ ] `--role worker` (default, current behavior unchanged)
- [ ] `--role reviewer --review-type plan|code|final`
- [ ] `--baseline <sha>` optional for code scope resolution
- [ ] JSON output includes `reviewType`, `scopePaths`, `selection`
- [ ] Update `printRulesHelp`
- [ ] `spine_review_step` after step

### Step 2: Tests
> **Code review checkpoint**

- [ ] CLI tests for reviewer role + review types
- [ ] Worker default role regression test
- [ ] `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Example commands in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-253 owns design doc examples)

**Check If Affected:**
- `docs/design/cursor-rules-discovery.md` — SP-253

## Completion Criteria

- [ ] All steps complete
- [ ] `spine rules select --role reviewer` previews selection
- [ ] Worker select unchanged
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-252): complete Step N — description`

## Do NOT

- Change review spawn (SP-251)
- Change worker selection logic

---

## Amendments (Added During Execution)
