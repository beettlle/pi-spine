# Task: SP-102 — Implement worktreeSetupHook (FR-WT-05)

**Created:** 2026-06-05
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** FR-WT-05 is config-stubbed only; devcontainer/iOS consumers need post-provision hook (symlink node_modules, copy DerivedData) with sandboxed command, 120s timeout, and required JSON result.
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 1, Reversibility: 1

## Mission

After lane worktree provision (batch start and resume repair paths), run optional `worktreeSetupHook` from spine-config when non-empty. Enforce **120s timeout**, require **JSON stdout** with `{ "ok": true }` (or documented error shape), journal `lane.setup_hook` success/failure, and fail lane provisioning on hook failure. Sandbox hook command path (relative, under `scripts/`, no traversal/symlink escape) mirroring `workerLaunchScript` validation.

**Incident context:** searchATon batch `20260605T160800` — lane-only devcontainer mounts need hook-driven symlinks after git worktree add.

## Dependencies

- **Task:** SP-101 (relative gitdir paths — hook runs on healthy worktree)

## Context to Read First

**Tier 3:**
- `docs/PRD.md` — FR-WT-05, §5.4 iOS/Xcode consumer note
- `src/batch/worktree.mjs` — `provisionLaneWorktree`
- `src/batch/engine.mjs` — provision loop (~164–179)
- `src/config/worker-launch-script.mjs` — sandbox pattern for config commands
- `bin/spine-preflight.mjs` — config validation surface

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/worktree.mjs`
- `src/batch/worktree-setup-hook.mjs` (new)
- `src/batch/engine.mjs`
- `bin/spine-preflight.mjs`
- `tests/batch/worktree-setup-hook.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Confirm `worktreeSetupHook` is empty-string default in templates; no runtime runner in `src/`
- [ ] Read FR-WT-05 JSON result contract in PRD

### Step 1: Sandbox + hook runner module

> **Plan-review checkpoint**

- [ ] Add `validateWorktreeSetupHook(config, projectRoot)` — relative path under `scripts/`, reject `..`/absolute/symlink escape
- [ ] Add `runWorktreeSetupHook({ projectRoot, worktreePath, batchId, laneNumber, config })` — spawn hook with worktree cwd, env `SPINE_WORKTREE`, `SPINE_BATCH_ID`, `SPINE_LANE_NUMBER`; 120s timeout; parse JSON stdout
- [ ] Wire validation into `validateSpineConfig` / `spine preflight`
- [ ] Call `spine_review_step` (plan)

### Step 2: Provision integration + journal

> **Code review checkpoint**

- [ ] Call hook from `provisionLaneWorktree` (or engine immediately after provision) when config non-empty; after SP-101 normalization
- [ ] Append `lane.setup_hook` journal event with `ok`, `durationMs`, `message`/`error`
- [ ] Fail lane provision with actionable error when hook times out or returns `ok: false`
- [ ] Call `spine_review_step` (code)

### Step 3: Testing & Verification

- [ ] Stub hook script: success JSON, timeout, malformed JSON, `ok: false`
- [ ] Preflight rejects unsafe hook paths
- [ ] FULL suite: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test`
- [ ] Coverage gate: `npm run coverage:check` — **≥77%**

### Step 4: Documentation & Delivery

- [ ] Operator runbook: when to set `worktreeSetupHook`, example symlink script
- [ ] STATUS.md discoveries

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — worktreeSetupHook opt-in + devcontainer note

**Check If Affected:**
- `templates/spine-config.json` — comment on hook field
- `docs/PRD.md` — hook JSON schema if underspecified

## Completion Criteria

- [ ] Non-empty hook runs after lane worktree add; empty hook is no-op
- [ ] Hook failure blocks batch start for that lane with journal evidence
- [ ] Preflight catches unsafe hook paths before batch

## Git Commit Convention

- `feat(SP-102): implement worktreeSetupHook runner`
- `test(SP-102): worktree setup hook sandbox and timeout`

## Do NOT

- Normalize gitdir paths (SP-101)
- Set `PI_SPINE_ROOT` (SP-103)
- Change lane commit behavior (SP-104)

---

## Amendments (Added During Execution)
