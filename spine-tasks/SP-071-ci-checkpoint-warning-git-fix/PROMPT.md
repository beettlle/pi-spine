# Task: SP-071 — CI checkpoint-warning git identity fix

**Created:** 2026-06-03
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Two stall/checkpoint tests fail on GitHub Actions because temp-repo `git commit` runs without `user.name`/`user.email`; local dev machines often mask this via global git config.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Restore green CI on `main` by fixing `tests/batch/checkpoint-warning.test.mjs` git fixture setup so `git commit` succeeds on identity-less runners. Align with existing test helpers (`tests/helpers/git-fixture.mjs`) and optionally harden `.github/workflows/ci.yml` git config for test fixtures.

## Dependencies

- **None**

## Context to Read First

**Tier 3:**
- Failed runs: [26911437218](https://github.com/beettlle/pi-spine/actions/runs/26911437218) (`534c3a7`), [26911648989](https://github.com/beettlle/pi-spine/actions/runs/26911648989) (`9665826`)
- `tests/batch/checkpoint-warning.test.mjs` — failing tests at lines ~99 and ~160
- `tests/helpers/git-fixture.mjs` — canonical pattern (`user.email`, `user.name` before commit)
- `.github/workflows/ci.yml` — only sets `init.defaultBranch`, not commit identity

**Failure summary (both runs):**
- `369 pass`, `2 fail` of `371` tests
- `resolveScopedDirtyPaths limits porcelain to file scope and task folder` — `Command failed: git commit -m init`
- `collectProgressSignals includes dirtyPaths for scoped changes` — same root cause

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/checkpoint-warning.test.mjs`
- `tests/helpers/git-fixture.mjs` (optional — extract shared bare-repo helper)
- `.github/workflows/ci.yml` (optional — add global test identity in "Configure git for test fixtures")

## Steps

### Step 0: Preflight

- [ ] Reproduce on a clean env: unset global git user, run `npm test -- tests/batch/checkpoint-warning.test.mjs`
- [ ] Confirm CI logs match local failure mode

### Step 1: Fix test git fixtures

> **Plan-review checkpoint**

- [ ] Before `git commit` in both failing tests, set local repo identity (`user.email`, `user.name`) — match `git-fixture.mjs` values
- [ ] Prefer extracting a tiny helper (e.g. `configureGitIdentity(cwd)`) in `tests/helpers/git-fixture.mjs` if it reduces duplication
- [ ] Do **not** weaken assertions — only fix fixture setup

**Artifacts:**
- `tests/batch/checkpoint-warning.test.mjs` (modified)
- Optional `tests/helpers/git-fixture.mjs` helper export

### Step 2: CI hardening + verification

- [ ] Optional: extend CI step to `git config --global user.email` / `user.name` for test fixtures (belt-and-suspenders)
- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Confirm checkpoint-warning tests pass without relying on developer global git config

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — only if CI troubleshooting section exists

## Completion Criteria

- [ ] `tests/batch/checkpoint-warning.test.mjs` passes on identity-less git config
- [ ] Full test suite green locally
- [ ] CI green on push to `main`

## Git Commit Convention

- **Step completion:** `feat(SP-071): complete Step N — description`
- **Fix:** `fix(SP-071): set git identity in checkpoint-warning test fixtures`

## Testing

```bash
npm run typecheck && SPINE_WORKER_STUB=1 npm test
# targeted:
npm test -- tests/batch/checkpoint-warning.test.mjs
```

## Do NOT

- Change stall/checkpoint production logic in `src/batch/heartbeat.mjs`
- Skip or delete the failing tests
- Broad-refactor all batch tests in this task

## Amendments

_(Workers only.)_
