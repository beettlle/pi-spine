# Incident replay fixtures

Bounded batch-state + journal tail snapshots for regression tests. Pattern mirrors SearchATon SAT-020 stall fixture (`tests/fixtures/stall-sat020/`).

| Fixture | Batch | Pattern | Test |
|---------|-------|---------|------|
| `orphan-running-resume.json` | `20260603T185308` | `task.started` → `lane.heartbeat` → silence with dead `workerPid` | `tests/batch/orphan-reconcile.test.mjs` |

Reference: [`docs/incidents/20260603-orphan-running-resume.md`](../../../docs/incidents/20260603-orphan-running-resume.md)
