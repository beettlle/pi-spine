# SAT-020 stall replay fixture

Replays the SearchATon batch `20260603T002945` / **SAT-020** stall pattern for integration tests:

1. Worker emits `task.step_completed` for steps 0–1 (checkpoint progress).
2. Worker touches a File Scope path without a lane commit or further checkpoints.
3. Worker goes silent until progress-aware stall kills the lane.

Use with stub worker env (see `tests/batch/stall-sat020-integration.test.mjs`):

| Variable | Purpose |
|----------|---------|
| `SPINE_WORKER_STUB=1` | Stub worker |
| `SPINE_WORKER_STUB_SAT020=1` | SAT-020 replay sequence |
| `SPINE_WORKER_STUB_FILE_SCOPE` | Scoped file to touch (e.g. `src/sat020-health.ts`) |
| `SPINE_WORKER_STUB_OUTPUT` | stderr tail captured on stall |
| `SPINE_WORKER_STUB_SAT020_HANG_MS` | Hang duration before exit without `.DONE` |

Lane config in tests uses sub-minute `checkpointWarningMinutes`, `stallTimeoutMinutes`, and `stallGraceAfterProgressMinutes` so the suite finishes quickly.

Reference: [`docs/features/stall-recovery-improvements-brief.md`](../../../docs/features/stall-recovery-improvements-brief.md)
