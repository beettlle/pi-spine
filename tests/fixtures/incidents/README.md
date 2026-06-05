# Incident replay fixtures

Bounded batch-state + journal tail snapshots for regression tests. Pattern mirrors SearchATon SAT-020 stall fixture (`tests/fixtures/stall-sat020/`).

| Fixture | Batch | Pattern | Test |
|---------|-------|---------|------|
| `orphan-running-resume.json` | `20260603T185308` | `task.started` → `lane.heartbeat` → silence with dead `workerPid` | [`tests/batch/orphan-reconcile.test.mjs`](../../batch/orphan-reconcile.test.mjs) |
| `resume-parallel-lane-orphan.json` | `20260603T224829` | Forced multi-task resume; parallel lane-1 `task.started`; engine died in `commitLaneWorktree`; post-resume silence | [`tests/batch/orphan-reconcile.test.mjs`](../../batch/orphan-reconcile.test.mjs) |
| `resume-orphan-historical-failure.json` | `20260603T224829` | Historical `task.failed` before `batch.resumed`; post-resume silence; dead `enginePid` | [`tests/batch/orphan-detect-scope.test.mjs`](../../batch/orphan-detect-scope.test.mjs) |
| `lane-worktree-devcontainer.json` | `20260605T160800` | Lane worktree launch failure (container-absolute gitdir, missing `PI_SPINE_ROOT`) | [`tests/batch/diagnosis-launch-failed.test.mjs`](../../batch/diagnosis-launch-failed.test.mjs) |
| `retry-clears-failed-classification.json` | `20260605T191325` | Retry success with journal `task.completed` but stale failed batch-state / `prompt_parse_failed` | [`tests/batch/retry-state-drift.test.mjs`](../../batch/retry-state-drift.test.mjs) |
| `pidless-ghost-running.json` | `20260603T224829` | `phase: running` with no `workerPid`/`enginePid`; post-resume journal stall | [`tests/batch/orphan-pidless-ghost.test.mjs`](../../batch/orphan-pidless-ghost.test.mjs) |

## Incident narratives

| Fixture | Doc |
|---------|-----|
| `orphan-running-resume.json` | [`docs/incidents/20260603-orphan-running-resume.md`](../../../docs/incidents/20260603-orphan-running-resume.md) |
| `resume-parallel-lane-orphan.json`, `resume-orphan-historical-failure.json`, `pidless-ghost-running.json` | [`docs/incidents/20260604-resume-parallel-lane-orphan.md`](../../../docs/incidents/20260604-resume-parallel-lane-orphan.md) |
| `lane-worktree-devcontainer.json` | [`docs/incidents/20260605-lane-worktree-devcontainer.md`](../../../docs/incidents/20260605-lane-worktree-devcontainer.md) |
| `retry-clears-failed-classification.json` | [`docs/incidents/20260605-retry-state-drift.md`](../../../docs/incidents/20260605-retry-state-drift.md) |
