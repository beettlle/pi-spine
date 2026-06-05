# Task: SP-100 — Accept `./scripts/` worker launch paths

**Created:** 2026-06-04
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** `validateWorkerLaunchScriptPath` rejects `./scripts/...` even when it resolves to `scripts/...`; docs and `spine init` examples use the dotted form — config UX only, no CLI symlink impact.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 1, Reversibility: 1

## Mission

Normalize relative config paths before the `scripts/` prefix check so values like `./scripts/spine-worker-launch.sh` validate the same as `scripts/spine-worker-launch.sh`. Apply the same normalization anywhere `worktreeSetupHook` uses a similar prefix rule (if present).

**Tracked separately from SP-099** per customer bug report (secondary issue).

## Dependencies

- **None** (may land in parallel with SP-099 — disjoint file scope)

## Context to Read First

**Tier 3:**
- `src/config/worker-launch-script.mjs` — `validateWorkerLaunchScriptPath`
- `tests/batch/worker-host.test.mjs` — existing validation tests
- `bin/spine-config.mjs` — calls `validateWorkerLaunchScriptConfig`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/worker-launch-script.mjs`
- `tests/batch/worker-host.test.mjs`
- `tests/config/worker-launch-script.test.mjs` (new, if cleaner than extending worker-host)

## Steps

### Step 0: Preflight

- [ ] Reproduce: `validateWorkerLaunchScriptPath(root, "./scripts/spine-worker-launch.sh")` fails today with `must live under scripts/`
- [ ] Confirm `scripts/spine-worker-launch.sh` passes with same on-disk file

### Step 1: Normalize relative prefix

- [ ] After trim/slash normalize, strip leading `./` via `path.posix.normalize` (or equivalent) before `startsWith("scripts/")`
- [ ] Keep existing rejection of `..`, absolute paths, and symlink escape tests green
- [ ] If `worktreeSetupHook` validation shares the pattern, apply same normalization there
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Test: `./scripts/spine-worker-launch.sh` → ok when file exists under project
- [ ] Test: `./scripts/../outside.sh` still rejected
- [ ] Test: `scripts/` form unchanged
- [ ] Run FULL suite: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Check init templates / settings docs for `./scripts/` examples — align wording if needed
- [ ] Discoveries in STATUS.md

## Documentation Requirements

**Check If Affected:**
- `templates/` spine-config examples
- `docs/adoption/bootstrap-checklist.md`

## Completion Criteria

- [ ] `./scripts/...` and `scripts/...` validate identically when resolving to the same file
- [ ] Traversal and symlink-escape tests still pass
- [ ] All tests passing

## Git Commit Convention

- `fix(SP-100): accept ./scripts/ worker launch paths`
- `test(SP-100): dot-prefix launch script validation`

## Do NOT

- Change symlink CLI entrypoint logic (SP-099)
- Allow paths outside `scripts/` after normalization

---

## Amendments (Added During Execution)
