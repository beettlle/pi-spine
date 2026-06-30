# Task: SP-364 — lane progress snapshot events

**Created:** 2026-06-29
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** New journal event type wired into existing worker-host poll loop; bounded payload.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix **GitHub issue #48**: emit `lane.progress_snapshot` journal events from progress signals already collected in `worker-host.mjs` without waiting for long heartbeat intervals.

**Required behavior:**

1. New journal type `lane.progress_snapshot` with bounded payload
2. Configurable interval (default 2 min); dedupe when signals unchanged
3. Payload: `workerPhase`, `dirtyPathCount`, `lastCommitAtMs`, `statusMtimeMs`, `stepCompletedAtMs`
4. Config key `lanes.progressSnapshotIntervalMinutes` in template
5. `summarizeJournalEvent` support

**Closes:** [#48](https://github.com/beettlle/pi-spine/issues/48)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #48
- `src/batch/worker-host.mjs`, `src/batch/heartbeat.mjs`, `src/batch/journal.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/worker-host.mjs`
- `src/batch/heartbeat.mjs`
- `src/batch/journal.mjs`
- `templates/spine-config.json`
- `tests/batch/progress-snapshot.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/progress-snapshot.test.mjs` |
| fileScopeMustChange | `src/batch/worker-host.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/progress-snapshot.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Audit `collectProgressSignals` and heartbeat emit paths

### Step 1: Emit progress_snapshot

- [ ] Add interval config and dedupe logic in worker-host poll loop
- [ ] Append journal events with bounded payload
- [ ] Update `summarizeJournalEvent`

### Step 2: Tests and template config

- [ ] Add `tests/batch/progress-snapshot.test.mjs`
- [ ] Add config key to `templates/spine-config.json`

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #48 (`gh issue close 48`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #48 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-364): complete Step N — description`

## Do NOT

- Emit full dirty path lists on every tick
- Change stall-kill semantics
