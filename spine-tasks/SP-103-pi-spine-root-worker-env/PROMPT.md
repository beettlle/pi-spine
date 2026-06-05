# Task: SP-103 — PI_SPINE_ROOT in worker spawn env

**Created:** 2026-06-05
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Devcontainer `workerLaunchScript` cannot resolve pi-spine package when engine runs inside consumer repo; workers need `PI_SPINE_ROOT` pointing at installed pi-spine checkout (project-local or global).
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 2

## Mission

Export `resolvePiSpineRoot()` from a shared module and set **`PI_SPINE_ROOT`** in worker child env (alongside existing `SPINE_PROJECT_ROOT`, `SPINE_WORKTREE`, etc.). Consumer launch scripts use it to find `bin/spine-worker-runner.mjs` and pi tooling when the batch engine cwd is the consumer project, not the pi-spine install tree.

**Bug:** searchATon batch `20260605T160800` / `20260603T224829` — initial wave tasks failed at worker launch (`PI_SPINE_ROOT` / devcontainer).

## Dependencies

- **Task:** SP-101 (healthy lane worktrees before real-pi launch validation)

## Context to Read First

**Tier 3:**
- `src/batch/worker-host.mjs` — `spawnWorkerChild` env block
- `bin/spine-cli/shared.mjs` — `PACKAGE_ROOT` pattern
- `bin/spine-preflight.mjs` — surface misconfiguration early
- `docs/incidents/20260604-resume-parallel-lane-orphan.md` — launch failure timeline

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/worker-host.mjs`
- `src/config/pi-spine-root.mjs` (new)
- `bin/spine-preflight.mjs`
- `tests/batch/worker-host.test.mjs` (extend)
- `tests/config/pi-spine-root.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Confirm `spawnWorkerChild` sets `SPINE_*` vars but not `PI_SPINE_ROOT`
- [ ] Identify how `PACKAGE_ROOT` is resolved in `bin/spine-cli/shared.mjs`

### Step 1: resolvePiSpineRoot + worker env

- [ ] Add `resolvePiSpineRoot({ importMetaUrl? })` — realpath of pi-spine package root (same logic as CLI `PACKAGE_ROOT`)
- [ ] Set `env.PI_SPINE_ROOT` in `spawnWorkerChild` and agent-session worker path if applicable
- [ ] Preflight advisory when `development.workerLaunchScript` is set and `PI_SPINE_ROOT` would be required
- [ ] Call `spine_review_step` (plan)

### Step 2: Testing & Verification

- [ ] Unit test: `resolvePiSpineRoot` returns directory containing `package.json` + `bin/spine.mjs`
- [ ] Worker-host test: spawned env includes `PI_SPINE_ROOT`
- [ ] FULL suite: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test`
- [ ] Coverage gate: `npm run coverage:check` — **≥77%**

### Step 3: Documentation & Delivery

- [ ] Operator runbook: devcontainer launch scripts should read `PI_SPINE_ROOT`
- [ ] STATUS.md discoveries

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — `PI_SPINE_ROOT` for custom launch scripts

**Check If Affected:**
- `docs/adoption/bootstrap-checklist.md`
- `templates/` worker launch script examples

## Completion Criteria

- [ ] Worker subprocess env always includes `PI_SPINE_ROOT` when spawned by engine
- [ ] Launch script can `exec "$PI_SPINE_ROOT/bin/spine-worker-runner.mjs"` without hard-coded paths

## Git Commit Convention

- `feat(SP-103): set PI_SPINE_ROOT in worker spawn env`
- `test(SP-103): pi-spine root resolution`

## Do NOT

- Implement `worktreeSetupHook` (SP-102)
- Change diagnosis taxonomy (SP-105)

---

## Amendments (Added During Execution)
