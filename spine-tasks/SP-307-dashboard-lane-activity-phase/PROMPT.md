# Task: SP-307 — Dashboard lane activity phase column

**Created:** 2026-06-18
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Journal inference + dashboard UI; new resolver logic with focused tests.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-307-dashboard-lane-activity-phase/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Add a **Phase** column to the dashboard Lanes table showing operator-facing task activity (worker, code review, final review, etc.) inferred from journal events and active tasks. Implement `resolveLaneActivityPhase()` in snapshot.mjs (Option A — no engine or batch-state schema changes).

## Dependencies

- **None**

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `src/dashboard/snapshot.mjs` — `resolveLaneHeartbeatMeta`, `buildLaneRows`
- `src/dashboard/view.mjs` — `buildLaneTableModel`
- `src/dashboard/public/index.html`, `src/dashboard/public/dashboard.js`
- `src/batch/review.mjs` — `journalReviewEvent` payload shape
- `tests/dashboard/snapshot.test.mjs`, `tests/dashboard/snapshot-lanes.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- `src/dashboard/public/index.html`
- `src/dashboard/public/dashboard.js`
- `tests/dashboard/snapshot-lanes.test.mjs` (or new `tests/dashboard/snapshot-lane-phase.test.mjs`)
- `tests/dashboard/ui-contract.test.mjs`
- `docs/adoption/operator-runbook.md` (optional one-line dashboard note)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/dashboard/snapshot.mjs`, `src/dashboard/public/dashboard.js` |
| minLineCoverage | 77 |

## Phase label taxonomy

| Display label | Inference |
|---------------|-----------|
| `—` | No active task on lane |
| `queued` | Active task `classification === "pending"` |
| `launching` | Latest `lane.heartbeat` `workerPhase: "launching"` for lane |
| `worker` | Latest heartbeat `workerPhase: "pi"` |
| `verifying` | Latest heartbeat `workerPhase: "verify"` |
| `plan review` | Open `review.started` with `reviewType: "plan"` (no matching `review.completed`/`review.failed` for same task+step) |
| `code review` | Open `review.started` with `reviewType: "code"` |
| `final review` | Open `review.started` with `reviewType: "final"` |
| `rework` | Recent `lane.completed` with `phase: "code_rework"` or `"final_rework"` for active task |
| `failed` | Recent `task.failed` for active task with no newer `task.started` |

**Precedence (highest first):** open review → failed → rework marker → heartbeat `workerPhase` → task classification.

## Steps

### Step 0: Preflight

- [ ] Read `resolveLaneHeartbeatMeta` and `resolveLaneAlert` lane-filter pattern (`laneNumber` + `lane-${n}` `laneId`)
- [ ] Confirm `journalReviewEvent` payloads include `taskId`, `laneNumber`, `reviewType`, `stepNumber`

**Plan-review checkpoint**

### Step 1: Resolver + snapshot wire-up

- [ ] Add exported `resolveLaneActivityPhase({ laneNumber, activeTaskIds, classifiedTasks, journalEvents })` returning `{ activityPhase, activityPhaseLabel }`
- [ ] Extract shared `laneEventMatches(laneNumber, event)` if it reduces duplication
- [ ] Wire into `buildLaneRows`; add fields to each lane row object

### Step 2: Dashboard UI

- [ ] Add `<th scope="col">Phase</th>` after **Status** in `index.html`
- [ ] Update `renderLanes()` to render `lane.activityPhaseLabel ?? "—"`
- [ ] Pass fields through `buildLaneTableModel` in `view.mjs`

### Step 3: Testing & Verification

- [ ] Unit tests with synthetic `journalEvents`:
  - heartbeat `pi` → `worker`
  - open `review.started` code → `code review`
  - open `review.started` final → `final review`
  - `lane.completed` `code_rework` → `rework`
  - no active tasks → `—`
- [ ] Update `ui-contract.test.mjs`: assert `Phase` column header in served HTML
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Optional: runbook dashboard § one line on Phase column (journal-inferred)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- Dashboard files in File Scope

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] Phase column visible on Lanes table for active batches
- [ ] Labels match taxonomy for tested journal sequences
- [ ] Tests and coverage gate passing
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-307): complete Step N — description`
- `test(SP-307): description`
- `fix(SP-307): description`

## Do NOT

- Modify `src/batch/engine-lanes/*`, batch-state schema, or `worker-host.mjs`
- Read `.reviews/` artifacts from disk in dashboard snapshot
- Expect in-worker plan review to always show as `plan review` (may show `worker` until journal event — document in STATUS if observed)

---

## Amendments (Added During Execution)
