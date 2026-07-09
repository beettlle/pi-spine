# Explore: done-marker-fail-closed

**Date:** 2026-07-09
**Status:** complete

## Summary

Issue [#190](https://github.com/beettlle/pi-spine/issues/190): engine promotes tasks to `succeeded` and merges without committed `.DONE` on the lane branch when `lane.completed` + `contract.verified` journal events exist. **Operator decision: fail-closed** — do not promote or merge unless `.DONE` is committed on the lane task branch (or on main post-integrate). SP-512 / `done_in_lane_terminal` reconcile must require filesystem truth via `classifyTaskDoneSemantics().doneInLane`.

## Codebase areas

- `src/batch/journal-rebuild.mjs` — `journalShowsDoneInLaneTerminalArtifacts`, `reconcileBatchStateDrift` sets `doneFileFound: true` with `skippedDoneOnDisk: true` without `.DONE` on disk
- `src/batch/attached-runner.mjs` — attached-runner promote path sets `doneFileFound: true` + `skippedDoneOnDisk: true` when `classified.doneInLane === true` without verifying committed marker
- `src/batch/diagnosis-task-done.mjs` — `classifyTaskDoneSemantics` already distinguishes `doneInLane` (filesystem) vs `doneFileFound` (batch-state); promotion paths must require `doneInLane` before terminal success
- `src/batch/resume-multi-lanes.mjs` — resume path may set `skippedDoneOnDisk: true`; audit for same gap
- `src/batch/engine-lanes/merge.mjs` — merge checks commits-ahead but not `.DONE` presence; add pre-merge guard
- `tests/batch/reconcile-done-inlane-terminal.test.mjs` — SP-512 fixture includes `.DONE` on lane; add negative case without `.DONE`

## Risks

- **Breaking orphan recovery (#170):** SP-512 assumed `.DONE` in lane; fail-closed preserves #170 when marker exists — only blocks when marker absent
- **Review Level 0 tasks without review:** `journalShowsDoneInLaneTerminalArtifacts` accepts `contract.verified` without `review.completed`; fail-closed is independent — still require `.DONE`
- **Resume reconcile:** attached-runner promote on resume must not bypass fail-closed

## Suggested file scopes

**SP-569 (implementation):**

- `src/batch/journal-rebuild.mjs`
- `src/batch/attached-runner.mjs`
- `src/batch/resume-multi-lanes.mjs` (if promote path found)
- `src/batch/engine-lanes/merge.mjs` (pre-merge `.DONE` guard)
- `tests/batch/done-marker-fail-closed.test.mjs` (new)
- `tests/batch/reconcile-done-inlane-terminal.test.mjs` (extend negative case)
- `docs/adoption/operator-runbook.md` (document fail-closed behavior vs `skippedDoneOnDisk`)

## Open questions

- None — fail-closed selected per operator (2026-07-09).
