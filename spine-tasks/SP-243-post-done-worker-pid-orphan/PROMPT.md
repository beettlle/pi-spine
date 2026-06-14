# Task: SP-243 — Post-done workerPid orphan false positive

**Created:** 2026-06-13
**Size:** S

## Review Level: 2

**Assessment:** SP-229 covered engine-owned review after worker death with `.DONE`; batch `20260613T234821` still diagnosed `worker_orphaned` when `worker.post_done_terminated` killed pi after grace while engine ran code review.

## Mission

After successful worker completion (including `post_done_terminated` with `.DONE` on disk), clear stale `lane.workerPid` and do not diagnose `worker_orphaned` when journal shows `lane.completed` for the running task (engine-owned review/commit path).

**Incident:** Batch `20260613T234821` (SP-234/236 wave): `worker.post_done_terminated` at 240s grace → `lane.completed` → `review.started` (code) but diagnose `worker_orphaned` on dead `workerPid` 25794.

## Dependencies

- **Task:** SP-229

## File Scope

- `src/batch/engine-lanes.mjs`
- `src/batch/orphan-detect.mjs`
- `tests/batch/diagnosis-orphan-taxonomy.test.mjs`

## Steps

### Step 0: Preflight

- [x] Reconstruct batch `20260613T234821` journal ordering

### Step 1: Fix workerPid lifecycle

- [x] Clear `lane.workerPid` on successful worker return before `lane.completed`
- [x] Skip `worker_orphaned` when scoped journal has `lane.completed` for running task

### Step 2: Testing & Verification

- [x] Regression test: dead workerPid + lane.completed → not worker_orphaned
- [ ] FULL test suite passing

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Post-done grace path does not wedge diagnose on worker_orphaned during engine review

---

## Amendments (Added During Execution)
