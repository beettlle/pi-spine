# Task: SP-711 — Lane commit ignore .pi/ and .pi-smart-router/

**Created:** 2026-08-19
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Extends SP-640 / #200 default ignore paths pattern; config-load only.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #255 — Lane completion must not commit pi session trees (`.pi/`, `.pi-smart-router/`) into orch merges. Extend `DEFAULT_WORKTREE_SETUP_IGNORE_PATHS` in `src/config/spine-config-load.mjs` (same pattern as `.venv` for #200). Operators may still opt in via explicit task `fileScope`; defaults stay ignored at lane commit.

## Dependencies

- **None**

## Context to Read First

- `src/config/spine-config-load.mjs` — `DEFAULT_WORKTREE_SETUP_IGNORE_PATHS`, `resolveWorktreeSetupIgnorePaths`
- `src/batch/lane-commit.mjs` — `ignorePatterns` usage
- `tests/batch/pi-smart-router-dirty.test.mjs` — existing dirty tests
- GitHub #255, closed #200

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/spine-config-load.mjs`
- `tests/batch/lane-commit-pi-ignore.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/lane-commit-pi-ignore.test.mjs tests/batch/pi-smart-router-dirty.test.mjs` |
| fileScopeMustChange | `src/config/spine-config-load.mjs`, `tests/batch/lane-commit-pi-ignore.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm `.venv` default ignore via SP-640
- [ ] Confirm lane-commit uses `resolveWorktreeSetupIgnorePaths`

### Step 1: Extend default ignore paths

- [ ] Add `.pi` and `.pi-smart-router` to `DEFAULT_WORKTREE_SETUP_IGNORE_PATHS`
- [ ] Unit test: porcelain paths under those trees filtered from lane commit staging

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — note default lane-commit ignores for agent runtime dirs

## Completion Criteria

- [ ] `.pi/` and `.pi-smart-router/` excluded from default lane commits
- [ ] Scoped tests pass
- [ ] Closes #255

## Do NOT

- Add `.pi/` to consumer repo `.gitignore` as part of this task
- Break explicit task fileScope opt-in for those paths
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-711): lane commit ignore .pi agent runtime dirs (#255)`
