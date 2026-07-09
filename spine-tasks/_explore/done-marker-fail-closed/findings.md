# Explore: done-marker-fail-closed

**Date:** 2026-07-09  
**Author:** SP-568 worker  
**Issue:** [#190](https://github.com/beettlle/pi-spine/issues/190)  
**Implementation follow-up:** SP-569  
**Related:** #170 (closed, SP-512) — opposite drift class

## Summary

Consumer batch `20260709T211740` (pi-smart-router) promoted task SP-146 to `succeeded`, merged, and integrated **without a committed `.DONE`** on the lane branch. Journal shows `task.completed` with `reconcileReason: "done_in_lane_terminal"` and `skippedDoneOnDisk: true` while `git show task/spine-lane-1-…:.DONE` fails. `spine plan pending` still lists SP-146 because planner exclusion uses on-disk `.DONE` on `main`.

**Operator decision (2026-07-09): fail-closed.** Block promote/merge until `.DONE` is **committed on the lane task branch** (or on `main` post-integrate). SP-512 / `done_in_lane_terminal` reconcile must not set `doneFileFound: true` or emit `skippedDoneOnDisk: true` when the lane branch lacks a committed marker.

### #190 vs #170

| | #170 (SP-512, closed) | #190 (open) |
|---|------------------------|-------------|
| Lane branch | `.DONE` **exists** (committed or on disk) | `.DONE` **never committed** on lane branch |
| Batch-state | Stuck `running` / `state_drift` | Promoted `succeeded`, merged |
| Reconcile intent | Heal cache toward filesystem truth | **Over-promotes** without filesystem/git truth |
| Fix direction | Keep SP-512 heal when marker exists | **Fail-closed** when marker absent |

## Codebase areas

### 1. Journal terminal artifact gate (no `.DONE` check)

`journalShowsDoneInLaneTerminalArtifacts` (`src/batch/journal-rebuild.mjs`) returns true when journal has `lane.completed` plus either approved review (`review.completed` / `task.verdict_recorded`) **or** `contract.verified` with `ok: true`. Review Level 0 tasks can satisfy via contract alone — matching #190 journal evidence for SP-146.

No filesystem or git check for `.DONE` in this function.

### 2. `reconcileBatchStateDrift` — `done_in_lane_terminal` promote (SP-512)

When `detectBatchStateDrift` reports `field: "doneInLane"` and:

- `classifiedShowsDoneInLaneDrift(classified)` is true
- `classified.doneInLane === true` (filesystem `fs.existsSync` in lane worktree)
- `journalShowsDoneInLaneTerminalArtifacts` is true
- cache status is not yet `succeeded`

…then `recordTaskSucceeded` sets `doneFileFound: true` and journals `task.completed` with `skippedDoneOnDisk: true`, `reconcileReason: "done_in_lane_terminal"`.

**Gap for fail-closed:** `doneInLane` uses **worktree filesystem** only (`diagnosis-task-done.mjs` `doneMarkerExists`), not **git-committed** truth on the lane branch. Uncommitted `.DONE` or stale worktree state can satisfy `doneInLane` while the branch tip lacks the marker (#190 git evidence).

`classifiedShowsDoneInLaneDrift` also returns true when `classification === "terminal-success"` (e.g. from batch-state `doneFileFound`) while status is still `running`; reconcile still requires `doneInLane === true` at promote time.

### 3. Attached-runner promote (`reconcilePausedResumeDoneInLane`)

`src/batch/attached-runner.mjs` — after paused force-resume, promotes `running`/`pending` tasks when `classifyTaskDoneSemantics().doneInLane === true` and `journalHasContractVerified`. Sets `doneFileFound: true` and journals `skippedDoneOnDisk: true` (no `reconcileReason`). Same filesystem-only `.DONE` check.

### 4. Resume fast-path (`markTaskCompleteFromDisk`)

`src/batch/resume-multi-lanes.mjs` — when `taskAlreadyComplete` sees `.DONE` in lane worktree for `running`/`pending`, skips worker and runs review + lane commit, then sets `doneFileFound: true` and journals `skippedDoneOnDisk: true`. Entry is gated on filesystem `.DONE` for non-terminal cache status; still no git-commit verification before promote.

### 5. Normal engine lane completion

`src/batch/engine-lanes.mjs` — after worker exit, journals `lane.completed` **before** review/contract phases. After lane commit, `recordTaskSucceeded(..., { doneFileFound: true })` unconditionally — no `.DONE` existence check. Normal path journals `task.completed` without `skippedDoneOnDisk`.

### 6. `classifyTaskDoneSemantics` (SP-344)

`src/batch/diagnosis-task-done.mjs` distinguishes:

- `doneFileFound` — batch-state / journal flag
- `doneOnMain` — `.DONE` under integration checkout tasks root
- `doneInLane` — `.DONE` in lane worktree (filesystem)

Any of the three sets `classification: "terminal-success"`. Promotion paths must not treat `doneFileFound` alone as sufficient for merge when fail-closed.

### 7. Merge phase (no `.DONE` guard)

`src/batch/engine-lanes/merge.mjs` `mergeLaneToOrch` checks `commitsAhead` and worktree drift; `requireLaneCommits` error text mentions `.DONE` without persisting changes but does **not** verify `.DONE` on the task branch before merge.

### 8. `skippedDoneOnDisk` journal emitters (complete inventory)

| Location | Trigger | `reconcileReason` |
|----------|---------|-------------------|
| `journal-rebuild.mjs` `reconcileBatchStateDrift` | doneInLane drift + journal artifacts | `done_in_lane_terminal` |
| `attached-runner.mjs` `reconcilePausedResumeDoneInLane` | paused resume + doneInLane + contract | — |
| `resume-multi-lanes.mjs` `markTaskCompleteFromDisk` | resume skip-worker + .DONE on disk | — |

Field name is misleading in SP-512 cases where `.DONE` **does** exist on disk.

### 9. SP-512 tests (`tests/batch/reconcile-done-inlane-terminal.test.mjs`)

Fixture `setupDoneInLaneDriftFixture` **always writes `.DONE`** into the lane worktree before reconcile. Tests validate #170 heal path (lane has marker, cache stuck `running`). **No negative case** where journal shows `lane.completed` + `contract.verified` but lane branch lacks committed `.DONE`.

## Risks

- **Breaking #170 orphan recovery:** Fail-closed must preserve SP-512 when committed `.DONE` exists on lane branch — only block when marker is absent on branch tip.
- **Filesystem vs git:** Fail-closed should verify **committed** `.DONE` on lane task branch (e.g. `git cat-file` / `git show branch:path`), not only `fs.existsSync` in worktree.
- **Review Level 0 / contract-only terminal:** `journalShowsDoneInLaneTerminalArtifacts` accepts `contract.verified` without review; fail-closed is independent — still require committed `.DONE`.
- **Resume reconcile:** `markTaskCompleteFromDisk` and attached-runner promote must not bypass fail-closed.
- **`skippedDoneOnDisk` semantics:** Operators may misread as “marker intentionally skipped”; document vs rename in SP-569.

## Suggested file scopes

**SP-569 (implementation):**

- `src/batch/journal-rebuild.mjs` — gate `reconcileBatchStateDrift` on committed `.DONE`; tighten `journalShowsDoneInLaneTerminalArtifacts` or add pre-promote guard
- `src/batch/diagnosis-task-done.mjs` — add `doneInLaneCommitted` (or extend `doneInLane`) via git lane-branch lookup
- `src/batch/attached-runner.mjs` — same guard on `reconcilePausedResumeDoneInLane`
- `src/batch/resume-multi-lanes.mjs` — `markTaskCompleteFromDisk` fail-closed before promote
- `src/batch/engine-lanes/merge.mjs` — pre-merge guard: lane branch must contain committed `.DONE`
- `src/batch/engine-lanes.mjs` — optional: do not set `doneFileFound: true` without marker check
- `tests/batch/done-marker-fail-closed.test.mjs` (new) — #190 negative fixture
- `tests/batch/reconcile-done-inlane-terminal.test.mjs` — extend: journal terminal artifacts without `.DONE` must not promote
- `docs/adoption/operator-runbook.md` — fail-closed vs `skippedDoneOnDisk` semantics

## Open questions

- None — fail-closed selected per operator (2026-07-09). Auto-heal (engine creates/commits `.DONE`) and document-only options rejected for v2.2.0.
