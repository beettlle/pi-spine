# Task: SP-084 — Heartbeat worker phase semantics

**Created:** 2026-06-03
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** `lane.heartbeat` reuses stale `statusMtimeMs` on fast-fail retries — dashboard implies progress during launcher-only failures.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Distinguish heartbeat **kinds** and include **worker phase** so UI/journal does not imply checkpoint progress during launcher preflight or before pi starts.

- Add payload fields: `heartbeatKind`: `worker_alive` | `checkpoint` | `file_scope_activity`
- Add `workerPhase`: `launching` | `pi` | `verify` | `unknown`
- Do not emit progress-class heartbeat until child is past launcher preflight OR mark explicitly as `launching`

## Dependencies

- **None**

## File Scope

- `src/batch/heartbeat.mjs`
- `src/batch/worker-host.mjs`
- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- `tests/batch/heartbeat.test.mjs`
- `tests/dashboard/snapshot.test.mjs`

## Steps

### Step 1: Heartbeat payload schema

- [ ] Extend `recordLaneHeartbeat` payload with kind + workerPhase
- [ ] Worker-host sets phase through spawn lifecycle
- [ ] `spine_review_step` after step

### Step 2: Dashboard display

- [ ] Snapshot exposes phase/kind; UI shows "launching" not false progress

### Step 3: Testing & Verification

- [ ] Test fast-fail retry does not show checkpoint progress
- [ ] FULL suite + coverage ≥77%

## Git Commit Convention

- `feat(SP-084): complete Step N — description`

## Do NOT

- Break existing heartbeat stall deadline logic without updating tests

---

## Amendments (Added During Execution)
