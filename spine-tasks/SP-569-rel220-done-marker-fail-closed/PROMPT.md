# Task: SP-569 — done-marker fail-closed engine

**Created:** 2026-07-09
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Engine reconcile and merge paths; consumer-visible planner divergence.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

**Closes:** [#190](https://github.com/beettlle/pi-spine/issues/190)

Implement **fail-closed** done-marker enforcement per [`spine-tasks/_explore/done-marker-fail-closed/findings.md`](../_explore/done-marker-fail-closed/findings.md):

1. Do **not** promote task to `succeeded` or merge lane when committed `.DONE` is absent on the lane task branch
2. Do **not** set `doneFileFound: true` or journal `skippedDoneOnDisk: true` unless filesystem `.DONE` exists (`classifyTaskDoneSemantics().doneInLane` or committed git path)
3. Pre-merge guard in engine-lanes merge when marker missing
4. Regression tests reproducing pi-smart-router SP-146 class (STATUS complete, no `.DONE`, must not promote)

Preserve SP-512 / #170 behavior when `.DONE` **is** present on lane branch.

## Dependencies

- **Task:** SP-568

## Context to Read First

- [`spine-tasks/_explore/done-marker-fail-closed/findings.md`](../_explore/done-marker-fail-closed/findings.md)
- [`tests/batch/reconcile-done-inlane-terminal.test.mjs`](../../tests/batch/reconcile-done-inlane-terminal.test.mjs)
- Issue [#190](https://github.com/beettlle/pi-spine/issues/190)

## File Scope

- `src/batch/journal-rebuild.mjs`
- `src/batch/attached-runner.mjs`
- `src/batch/resume-multi-lanes.mjs`
- `src/batch/engine-lanes/merge.mjs`
- `tests/batch/done-marker-fail-closed.test.mjs`
- `tests/batch/reconcile-done-inlane-terminal.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/done-marker-fail-closed.test.mjs` |
| fileScopeMustChange | `src/batch/journal-rebuild.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings and #190 journal/git evidence
- [ ] Identify all `skippedDoneOnDisk: true` emitters

### Step 1: Reconcile + attached-runner fail-closed

- [ ] Gate `reconcileBatchStateDrift` done-in-lane path on `doneInLane === true` from classification
- [ ] Gate attached-runner promote on committed `.DONE` in lane worktree (git ls-tree or fs + git status)
- [ ] Audit `resume-multi-lanes.mjs` for same bypass

### Step 2: Pre-merge guard + tests

- [ ] Add merge-phase check: fail with actionable error when `.DONE` not on lane branch
- [ ] New `done-marker-fail-closed.test.mjs` — negative case without `.DONE` must not promote
- [ ] Extend SP-512 test — positive case with `.DONE` still passes

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Runbook section: fail-closed vs `skippedDoneOnDisk` semantics
- [ ] Comment on #190 with behavior summary
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Missing `.DONE` blocks promote/merge; planner stays consistent with batch outcome
- [ ] SP-512 positive reconcile unchanged

## Git Commit Convention

- `fix(SP-569): fail-closed done marker before merge (#190)`

## Do NOT

- Auto-create `.DONE` on behalf of workers (rejected option 2)
- Document-only change without engine guard (rejected option 3)
