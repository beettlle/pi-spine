# Task: SP-844 — Lane commits keep tool state and earlier tasks' .DONE markers

**Created:** 2026-10-22
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** The sanitizer runs before every lane commit. Over-keeping leaves gitignored junk that fails the dirty gate; under-keeping keeps deleting the stet session (#349) and earlier tasks' `.DONE` markers.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** `sanitizeGitignoredArtifactsBeforeLaneCommit` (`src/batch/lane-dirty-check.mjs` ~327-353) maps worktree-only gitignored paths to roots via `gitignoredArtifactRootForPath` (~255-290, `.review` at ~275) and runs `git clean -fdX -- <root>`, wiping `.review/` (stet session + `spine-stet-baseline.ref`) between tasks serialized on one lane. `worktreeSetupHook` runs once per lane, so the next task's stet Contract has no session. `src/batch/lane-dirty-check-commit.mjs` holds a second copy of the same sanitizer (~204-229); no `src/` module imports it — only `tests/batch/pi-smart-router-dirty.test.mjs` and `tests/arch/ts-nocheck-guard.test.mjs` reference it. In v2.28 Batch D (5 tasks, same lanes), each same-lane completion commit deleted the earlier tasks' `.DONE` markers; they had to be restored on the lane by hand. The deleting path is not yet identified — candidates are the staging in `commitLaneWorktree` / `commitLaneAndValidateWorktree` (`src/batch/lane-commit.mjs` ~221-412) and `src/batch/engine-lanes/commit.mjs`.

## Mission

Closes #349 — Two tasks serialized on one lane both keep their tool state and completion markers:

1. **Keep paths** — New config `lanes.laneCommitKeepPaths` (string[], default `[".review/"]`), validated in the config schema and listed in `spine settings` fields. The sanitizer never cleans a root that equals or sits under a keep path. Journal nothing new; return `{ cleanedRoots, keptRoots }`.
2. **One sanitizer** — Delete `src/batch/lane-dirty-check-commit.mjs`. Point its test imports at `src/batch/lane-dirty-check.mjs` and remove its entry from the ts-nocheck guard list if present.
3. **`.DONE` survival** — Reproduce with a test first: two tasks committed in sequence on one lane worktree; after the second task's lane commit, the first task's `.DONE` is still present on the lane branch. Then fix the deleting path.

## Dependencies

- **None**

## Context to Read First

- GitHub #349 (workaround already on main: `982ec8ed`)
- `src/batch/lane-dirty-check.mjs` 50-70, 230-360
- `src/batch/lane-dirty-check-commit.mjs` 190-230
- `src/batch/lane-commit.mjs` 221-412
- `src/batch/engine-lanes/commit.mjs` (whole file)
- `scripts/spine-worktree-setup.sh`, `scripts/spine-stet-contract-run.sh`
- `tests/batch/pi-smart-router-dirty.test.mjs`, `tests/batch/gitignored-auto-clean.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` for the stet step of the Contract only
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/lane-dirty-check.mjs` — 489 lines; stays ≤ 500: keep-path filtering goes in a new `src/batch/lane-commit-keep-paths.mjs`, and the sanitizer gains at most a call plus an option (net ≤ +8 lines)
- `src/batch/lane-commit-keep-paths.mjs` (new)
- `src/batch/lane-dirty-check-commit.mjs` (delete)
- `src/batch/lane-commit.mjs`
- `src/batch/engine-lanes/commit.mjs`
- `src/config/spine-config-schema.mjs`
- `src/config/settings-fields.mjs`
- `tests/batch/pi-smart-router-dirty.test.mjs`
- `tests/batch/lane-commit-keep-paths.test.mjs` (new)
- `tests/config/settings-fields.test.mjs`
- `tests/arch/ts-nocheck-guard.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/lane-commit-keep-paths.test.mjs tests/batch/pi-smart-router-dirty.test.mjs tests/batch/gitignored-auto-clean.test.mjs tests/batch/graphify-out-dirty.test.mjs tests/config/settings-fields.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| fileScopeMustChange | `src/batch/lane-dirty-check.mjs`, `src/batch/lane-commit-keep-paths.mjs`, `tests/batch/lane-commit-keep-paths.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `sanitizeGitignoredArtifactsBeforeLaneCommit`, `commitLaneWorktree`, `commitLaneAndValidateWorktree`
- [ ] `rg -n "lane-dirty-check-commit" src bin tests scripts` — record every reference

### Step 1: Reproduce `.DONE` deletion

- [ ] Failing test: two tasks committed in sequence on one lane worktree; the first task's `.DONE` must survive the second lane commit
- [ ] Record the deleting call path in STATUS.md Discoveries

**Artifacts:**
- `tests/batch/lane-commit-keep-paths.test.mjs` (new)

### Step 2: Keep paths + single sanitizer

- [ ] `lanes.laneCommitKeepPaths` schema + settings field (default `[".review/"]`)
- [ ] Keep-path filtering in `lane-commit-keep-paths.mjs`; sanitizer skips kept roots
- [ ] Delete `lane-dirty-check-commit.mjs`; repoint tests

**Artifacts:**
- `src/batch/lane-commit-keep-paths.mjs` (new)
- `src/batch/lane-dirty-check.mjs` (modified)
- `src/batch/lane-dirty-check-commit.mjs` (deleted)

### Step 3: Fix `.DONE` deletion

- [ ] Fix the path found in Step 1; Step 1 test passes
- [ ] Test: `.review/session.json` and `.review/spine-stet-baseline.ref` survive a lane commit; `.pi-smart-router/` still cleaned

**Artifacts:**
- `src/batch/lane-commit.mjs` and/or `src/batch/engine-lanes/commit.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Runbook: `lanes.laneCommitKeepPaths` and the #349 workaround it replaces
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-844-lane-commit-keep-paths/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-844`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — lane commit keep paths

**Check If Affected:**
- `skills/spine-release-operator/SKILL.md`

## Completion Criteria

- [ ] Two tasks serialized on one lane keep `.review/` state and both `.DONE` markers (test)
- [ ] One sanitizer implementation; `lane-dirty-check-commit.mjs` removed
- [ ] `src/batch/lane-dirty-check.mjs` ≤ 500 lines

## Git Commit Convention

- `fix(SP-844): keep lane tool state and .DONE markers across lane commits (#349)`

## Do NOT

- Run `worktreeSetupHook` per task (keep-path fix is the chosen option)
- Stop cleaning `.pi-smart-router/`, `.spine/runtime/`, or coverage roots
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
