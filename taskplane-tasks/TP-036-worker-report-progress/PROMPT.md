# Task: TP-036 — spine_report_progress core + CLI

**Created:** 2026-06-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-036-worker-report-progress/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Implement **`spine_report_progress`** backend (PRD §14.5, §18.4) — journal `task.step_completed` events that feed stall detection.

Deliverables:
1. **`src/worker-tools/report-progress.mjs`** — `reportTaskProgress({ projectRoot, batchId, taskId, laneId, step, checkboxesComplete, checkboxesTotal, journal? })`:
   - Append journal event `task.step_completed` with ISO timestamp + step metadata
   - Return `{ ok, eventId? }`; fail closed when batch context missing
2. **`bin/spine-report-progress.mjs`** + `spine report progress` subcommand (for worker shell-out parity)
3. **Heartbeat integration** — ensure `src/batch/heartbeat.mjs` treats recent `task.step_completed` for lane as activity signal (extend if not already)
4. **Tests** — journal append; heartbeat sees progress; missing batchId error

**Success:** CLI call appends journal line; heartbeat test proves stall suppression.

## Dependencies

- **TP-030** — journal + batch context stable

## Context to Read First

**Tier 3:**
- `docs/PRD.md` §14.5, §18.4 stall table
- `src/batch/heartbeat.mjs`, journal append helpers from `src/batch/journal.mjs`
- `bin/spine-review-step.mjs` — env var pattern (`SPINE_*`)

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `src/worker-tools/report-progress.mjs` (new)
- `bin/spine-report-progress.mjs` (new)
- `bin/spine.mjs` — `report progress` subcommand
- `src/batch/heartbeat.mjs` (if activity signal missing)
- `tests/worker-tools/report-progress.test.mjs` (new)
- `tests/batch/heartbeat.test.mjs` (extend)

## Steps

### Step 0: Preflight

- [ ] Grep journal for `task.step_completed` schema in PRD; read heartbeat stall logic
- [ ] Baseline tests

### Step 1: Progress reporter

> **Plan-review checkpoint**

- [ ] Implement pure reporter + journal append
- [ ] CLI wrapper reading `SPINE_BATCH_ID`, `SPINE_TASK_ID`, `SPINE_LANE_ID` env vars
- [ ] Unit tests with temp journal dir

**Artifacts:** `src/worker-tools/report-progress.mjs`, `bin/spine-report-progress.mjs`, tests

### Step 2: Heartbeat wiring

> **Code review checkpoint**

- [ ] Extend heartbeat to honor recent `task.step_completed` for lane/task
- [ ] Add/adjust heartbeat test fixture (silent tools, progress events only)

### Step 3: Verification

- [ ] Full suite green

## Completion Criteria

- [ ] Journal event written with correct shape
- [ ] Heartbeat respects progress events
- [ ] Full suite green

## Must Update

- `docs/compatibility/taskplane-gap-list.md` — mark progress tool implemented

## Check If Affected

- `docs/PRD.md` — only if behavior diverges from spec
- `bin/spine.mjs` help text

## Do NOT

- Do not register Pi extension tools yet (TP-037+)
- Do not change review step behavior

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-031): spine deps CLI`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
