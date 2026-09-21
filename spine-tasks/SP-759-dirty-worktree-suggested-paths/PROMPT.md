# Task: SP-759 — DirtyWorktree suggestedCommand from actual dirty paths

**Created:** 2026-09-21
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Diagnosis UX only in suggestedCommand builders; wrong path still fails DirtyWorktree — this only fixes the remediation hint.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** `buildPrimaryFailureSuggestedCommand` hardcodes `git checkout -- extension/coverage` for every DirtyWorktree, even when the dirty path is unrelated (e.g. tracked `.pi-smart-router/state.db`).

## Mission

Closes #288 — When diagnosing `DirtyWorktree`, build `suggestedCommand` from the actual dirty path(s) in the failure payload / lane dirty-check (same pattern as gitignored merge repair). Fall back to `git -C <laneWorktree> status --porcelain` + `spine batch retry <taskId>` when paths are unknown. Do not hardcode `extension/coverage` unless that path appears in the dirty set.

## Dependencies

- **None**

## Context to Read First

- `src/batch/diagnosis-primary-failure.mjs` — `buildPrimaryFailureSuggestedCommand`
- `src/batch/diagnosis-suggested-command.mjs` — `buildSuggestedCommand` / dirty path helpers
- `src/batch/diagnosis-merge-failure.mjs` — gitignored path suggestedCommand precedent
- `tests/batch/diagnosis.test.mjs`
- GitHub #288

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis-primary-failure.mjs`
- `src/batch/diagnosis-suggested-command.mjs`
- `tests/batch/diagnosis.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/diagnosis.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis-primary-failure.mjs`, `tests/batch/diagnosis.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm DirtyWorktree branch always emits `extension/coverage` today
- [ ] Locate where dirty paths are available on diagnosis ctx / failure payload
- [ ] Dependencies satisfied

### Step 1: Path-aware DirtyWorktree suggestedCommand

- [ ] Prefer actual dirty paths from failure payload / ctx when present
- [ ] Fall back to generic `git status --porcelain` + retry when paths unknown
- [ ] Only mention `extension/coverage` when that path is in the dirty set
- [ ] Unit tests cover path-aware vs fallback vs coverage-path cases

**Artifacts:**
- `src/batch/diagnosis-primary-failure.mjs` (modified)
- `tests/batch/diagnosis.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (docs deferred to SP-765)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — DirtyWorktree table still mentions hardcoded coverage

## Completion Criteria

- [ ] DirtyWorktree suggestedCommand uses actual dirty paths when known
- [ ] Scoped diagnosis tests pass
- [ ] Closes #288

## Git Commit Convention

- `fix(SP-759): DirtyWorktree suggestedCommand from actual dirty paths (#288)`

## Do NOT

- Change DirtyWorktree detection / lane-commit fail criteria
- Auto-clean tracked ignore-matched paths
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
