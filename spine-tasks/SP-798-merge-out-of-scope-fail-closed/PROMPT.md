# Task: SP-798 — Lane merge: never silently discard lane-committed out-of-scope changes

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Every lane merge into orch passes through this resolver; fail-closed can turn previously "successful" merges into `MergeConflict` failures.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** `tryAutoResolveOutOfScopeMergeConflict` (`src/batch/engine-lanes/merge.mjs` ~196-221) resolves any conflict on a path outside the lane's File Scope with `git checkout --ours` (orch's version). A path only conflicts when *both* sides changed it, so this always discards lane work, and nothing journals which paths were dropped. It takes `laneChangedFiles` as `_laneChangedFiles` and never uses it; ~280-287 computes it with two git calls anyway, and the error text (~409-412) claims a condition that is never checked. Separately, the bare `catch {}` around `git merge` (~566) routes every merge failure (hook, lock, untracked-overwrite) to the resolver, and with no unmerged paths the result is mapped to `"MergeConflict"` (~575). `src/batch/resume.mjs` ~455 calls `mergeLaneToOrch` without `laneFileScopePaths`, so resume merges behave differently.

## Mission

Closes #304 — No lane-committed out-of-scope change is discarded without a journal event; non-allow-listed conflicts fail closed; non-conflict merge failures are classified `MergeFailed`.

1. **Allow-list config**: add `lanes.outOfScopeMergeAllowList` (array of glob patterns) to `LANES_DEFAULTS` in `src/config/defaults.mjs`, default `[".spine/rules-manifest.json", "package-lock.json", "**/package-lock.json"]`. Match with the same glob helper `pathInLaneFileScope` uses.
2. **Resolver**: for an out-of-scope conflicted path —
   - allow-listed: record the lane blob (`git rev-parse :3:<path>`), then `checkout --ours`; collect `{ path, laneBlob }`;
   - not allow-listed: return `{ ok: false, failureClass: "MergeConflict", error: "Lane <n> (<taskBranch>) changed out-of-scope path <path> that also changed on <orchBranch>; add it to File Scope or lanes.outOfScopeMergeAllowList" }`.
3. **Journal + return**: on success, `mergeLaneToOrch` returns `discardedOutOfScope: [{ path, laneBlob }]`, and `mergeWaveLanesToOrch` journals `batch.merge_out_of_scope_discarded` `{ laneNumber, taskBranch, paths, laneBlobs }` when non-empty.
4. **Cleanup**: delete the unused `laneChangedFiles` computation and parameter; fix the error text.
5. **Classify merge failures**: in the `git merge` catch, call the conflict resolver only when `listUnmergedPaths` is non-empty; otherwise abort the merge and return `{ ok: false, failureClass: "MergeFailed", error: <git stderr> }`. Capture stderr from the thrown error instead of a bare `catch {}`.
6. **Resume parity**: `src/batch/resume.mjs` passes `laneFileScopePaths` to `mergeLaneToOrch`, derived the same way as the normal wave path. `resume.mjs` is at 498/500 lines — keep it ≤ 500 (compute the paths in a helper in `merge.mjs` if needed).
7. **Tests** (`tests/batch/lane-merge-out-of-scope.test.mjs`): replace test 1's scenario with a real conflict (both sides edit the same out-of-scope file) → fails closed with the message; same with an allow-listed path → merges, `discardedOutOfScope` + journal event name the path and blob; untracked-file-would-be-overwritten case → `MergeFailed` with stderr; resume passes File Scope.

## Dependencies

- **None**

## Context to Read First

- GitHub #304
- `src/batch/engine-lanes/merge.mjs` — `tryAutoResolveOutOfScopeMergeConflict` (~196), `tryAutoResolveMergeConflicts`, `mergeLaneToOrch` (~540-620), `mergeWaveLanesToOrch` (~740-770)
- `src/batch/resume.mjs` ~455
- `src/config/defaults.mjs` — `LANES_DEFAULTS`
- `tests/batch/lane-merge-out-of-scope.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (tests create temp git repos)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/engine-lanes/merge.mjs`
- `src/batch/resume.mjs`
- `src/config/defaults.mjs`
- `tests/batch/lane-merge-out-of-scope.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/lane-merge-out-of-scope.test.mjs tests/batch/engine.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/merge.mjs`, `tests/batch/lane-merge-out-of-scope.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce the discard in a temp repo (both sides edit an out-of-scope file)
- [ ] `rg -n "MergeConflict|outOfScopePaths|laneChangedFiles" src tests` — list consumers of the current shapes
- [ ] Dependencies satisfied

### Step 1: Allow-list + fail-closed resolver

- [ ] `lanes.outOfScopeMergeAllowList` default added
- [ ] Allow-listed → blob recorded + ours; otherwise fail closed with message
- [ ] Unused `laneChangedFiles` removed; error text fixed

**Artifacts:**
- `src/batch/engine-lanes/merge.mjs`, `src/config/defaults.mjs` (modified)

### Step 2: Journal + failure classification + resume parity

- [ ] `discardedOutOfScope` returned; `batch.merge_out_of_scope_discarded` journaled
- [ ] Non-conflict failures → `MergeFailed` with stderr
- [ ] Resume passes `laneFileScopePaths`; `resume.mjs` ≤ 500 lines

**Artifacts:**
- `src/batch/engine-lanes/merge.mjs`, `src/batch/resume.mjs` (modified)

### Step 3: Tests

- [ ] Real conflict fails closed
- [ ] Allow-listed conflict journaled with blob
- [ ] Untracked-overwrite → `MergeFailed`
- [ ] Resume parity

**Artifacts:**
- `tests/batch/lane-merge-out-of-scope.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-803 documents the allow-list and new failure class)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §4.1 Integrate merge conflicts

## Completion Criteria

- [ ] No out-of-scope lane change discarded without a journal event naming the path
- [ ] Non-allow-listed out-of-scope conflicts fail the merge with a clear message
- [ ] Non-conflict merge failures classified `MergeFailed` with stderr
- [ ] Resume and normal merges pass the same File Scope
- [ ] Closes #304

## Git Commit Convention

- `fix(SP-798): fail closed on out-of-scope lane merge conflicts (#304)`

## Do NOT

- Decompose `merge.mjs` (#322)
- Add semantic merge strategies
- Change integrate (orch → base) conflict handling
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
