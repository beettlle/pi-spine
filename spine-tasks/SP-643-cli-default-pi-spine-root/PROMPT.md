# Task: SP-643 — CLI default PI_SPINE_ROOT to cwd

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Small env bootstrap + doctor advisory change; low blast radius.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

**Related:** v2.6.0 dogfood ergonomics (unset `PI_SPINE_ROOT` + `worktreeSetupHook` forced operators to export cwd before preflight/batch). **Does not close** [#203](https://github.com/beettlle/pi-spine/issues/203) (that issue is multi-lane dead-engine orphan — SP-646/SP-647). Version skew is [#204](https://github.com/beettlle/pi-spine/issues/204) / SP-648.

When `PI_SPINE_ROOT` is unset, the CLI should default it to `process.cwd()` so checkout dogfood and consumer projects with `worktreeSetupHook` do not fail doctor/preflight solely for a missing env var. Keep `resolvePiSpineRoot` package-root semantics for worker spawn unchanged (config override + package discovery via `import.meta.url`).

**Source:** Operator follow-up during v2.6.0 dogfood (batch `20260712T234002`); release add-on to Phase 70.

## Dependencies

- **None**

## Context to Read First

- `src/config/pi-spine-root.mjs` — `resolvePiSpineRoot`, `validatePiSpineRootConfig`
- `src/doctor/worktree-health.mjs` — unset env + `worktreeSetupHook` check
- `bin/spine.mjs` — CLI entry bootstrap
- `src/batch/worker-spawn.mjs` — worker env uses `resolvePiSpineRoot` (do not weaken)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/pi-spine-root.mjs`
- `bin/spine.mjs`
- `src/doctor/worktree-health.mjs`
- `tests/batch/worker-host-env.test.mjs` (or new focused test under `tests/config/` / `tests/doctor/`)
- `tests/doctor/worktree-health.test.mjs`
- `docs/adoption/operator-runbook.md` — one short note that CLI defaults unset `PI_SPINE_ROOT` to cwd (SP-641 may expand; this task owns the one-liner if not already present)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/doctor/worktree-health.test.mjs tests/batch/worker-host-env.test.mjs` |
| fileScopeMustChange | `src/config/pi-spine-root.mjs`, `bin/spine.mjs`, `src/doctor/worktree-health.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm doctor fails today when `PI_SPINE_ROOT` unset and `worktreeSetupHook` is set
- [ ] Confirm `resolvePiSpineRoot` remains package-root oriented for workers

### Step 1: Default env at CLI bootstrap

- [ ] Add `ensureDefaultPiSpineRootEnv()` (or equivalent) in `src/config/pi-spine-root.mjs`: if unset/empty, set `process.env.PI_SPINE_ROOT = process.cwd()`; do not override an explicit env value
- [ ] Call it early from `bin/spine.mjs` (before command dispatch)
- [ ] Update doctor worktree check so unset+hook is not a hard fail when default applies (prefer calling ensure, or treat post-default as ok)
- [ ] Unit tests: default when unset; preserve when set; doctor+hook with unset becomes ok after ensure

### Step 2: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Run contract `testCommand` only (scoped) — do **not** run full `npm test` or `npm run coverage:check` in the lane (parallel waves overload the host; integrate / `npm run release:check` owns full suite + coverage)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] One-line operator note (runbook) if not already covered by SP-641
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — brief `PI_SPINE_ROOT` default note (or confirm SP-641 already covers it)

**Check If Affected:**
- `docs/adoption/bootstrap-checklist.md`
- `docs/incidents/20260605-lane-worktree-devcontainer.md`

## Completion Criteria

- [ ] `spine doctor` / preflight no longer requires a manual `export PI_SPINE_ROOT=$PWD` solely because the env was unset
- [ ] Explicit `PI_SPINE_ROOT` still wins
- [ ] Worker `resolvePiSpineRoot` package semantics unchanged

## Do NOT

- Change `resolvePiSpineRoot` to always return `process.cwd()` for workers
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Implement #203 orphan recovery (separate bug)
- Skip tests

## Git Commit Convention

- `fix(SP-643): default PI_SPINE_ROOT to cwd when unset (#203)`
