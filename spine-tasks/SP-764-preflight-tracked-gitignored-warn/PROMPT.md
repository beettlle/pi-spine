# Task: SP-764 — Preflight/doctor warn when gitignored paths are still tracked

**Created:** 2026-09-21
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Advisory check only — must not fail preflight by default; warn with remediation.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** Tracked files that also match `.gitignore` (e.g. `.pi-smart-router/state.db`) mutate in lane worktrees and fail DirtyWorktree after PASS. Operators need an earlier warning.

## Mission

Closes #289 — Add a non-blocking `spine preflight` / `spine doctor` warning when `git ls-files -i --exclude-standard` (tracked + ignore-matched) is non-empty. Remediation text: `git rm -r --cached -- <paths>` (keep working tree; rely on `.gitignore`). Optional strict fail remains out of scope unless a documented flag already exists.

## Dependencies

- **None**

## Context to Read First

- `src/config/spine-preflight-lib.mjs` — preflight check registration
- `src/config/preflight/` — existing warn-style checks
- `src/doctor/run-doctor-checks.mjs`
- GitHub #289

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/preflight/tracked-gitignored.mjs`
- `src/config/spine-preflight-lib.mjs`
- `src/doctor/run-doctor-checks.mjs`
- `tests/config/preflight-tracked-gitignored.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/config/preflight-tracked-gitignored.test.mjs` |
| fileScopeMustChange | `src/config/preflight/tracked-gitignored.mjs`, `tests/config/preflight-tracked-gitignored.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm no existing tracked+gitignored doctor/preflight check
- [ ] Dependencies satisfied

### Step 1: Advisory check

- [ ] Implement check using `git ls-files -i --exclude-standard` (bounded path list in detail)
- [ ] Wire into preflight + doctor as `ok: true, warning: true` when non-empty
- [ ] Remediation mentions `git rm --cached`
- [ ] Unit tests with temp git repo fixture

**Artifacts:**
- `src/config/preflight/tracked-gitignored.mjs` (new)
- preflight/doctor wiring (modified)
- `tests/config/preflight-tracked-gitignored.test.mjs` (new)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-765 owns operator docs)

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] Preflight/doctor warn when tracked ignore-matched paths exist
- [ ] Default path remains non-blocking
- [ ] Closes #289

## Git Commit Convention

- `feat(SP-764): preflight warn tracked gitignored paths (#289)`

## Do NOT

- Fail preflight by default on this signal
- Auto `git rm --cached` without operator consent
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
