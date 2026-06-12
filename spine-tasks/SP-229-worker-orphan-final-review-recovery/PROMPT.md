# Task: SP-229 — Worker orphan final-review recovery

**Created:** 2026-06-12
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Real-pi worker dies while task status is `running` and engine is in engine-owned code/final review; operator must `pause` + `resume --force` despite `.DONE` and APPROVE artifacts in worktree (SP-203 fixed engine/resume race, not this wedge).
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

When **`worker_orphaned`** is diagnosed for a lane that already has deliverable work on disk (`.DONE` in worktree, and/or `review.completed` code APPROVE, contract verified), the engine must **advance the land loop without operator pause/resume**:

1. Reconcile ghost `running` task → continue engine code/final review phases using worktree artifacts.
2. Honor existing journal/artifact verdicts (mirror SP-192/SP-203).
3. Surface actionable diagnose only when recovery cannot proceed (missing `.DONE`, failed contract, etc.).

**Incidents (SP-205–225 stress test):**
- Batch `20260612T193902` (SP-209): worker pid dead during `review.started` (final); `.DONE` in worktree; `worker_orphaned`; `batch retry` refused while running; recovered only via `pause` + `resume --force`.
- Batch `20260612T202559` (SP-211): same pattern during engine final review after code APPROVE + contract.verified.

**Required behavior:**
1. On orphan detection mid-task, if worktree has `.DONE` and no blocking contract failure, transition task to engine-owned review/commit path (do not require live worker pid).
2. `spine batch retry` / diagnose should suggest **`resume --force`** (or auto-recover in attached engine) instead of wedging on `running` + dead `workerPid`.
3. Journal: avoid duplicate `review.started` when honored PASS/APPROVE already exists.
4. Regression tests with fixtures mimicking dead workerPid + worktree `.DONE` + code review APPROVE.

## Dependencies

- **Task:** SP-203
- **Task:** SP-193
- **Task:** SP-115

## Context to Read First

**Tier 3:**
- `src/batch/worker-host.mjs` — post-done grace, worker lifecycle
- `src/batch/engine-lanes.mjs` — code/final review phases after worker
- `src/batch/reconcile.mjs` — `worker_orphaned`, ghost running reconciliation
- `src/batch/review.mjs` — `findCompletedFinalReview`, `findCompletedCodeReview`
- `src/batch/resume-multi.mjs` — `--force` resume path
- Batches `20260612T193902`, `20260612T202559` journals + worker output logs
- `tests/batch/engine-review-orphan.test.mjs`
- `tests/batch/diagnosis-orphan-taxonomy.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (stub/fixture tests); optional manual real-pi replay on SP-209-shaped task

## File Scope

- `src/batch/engine-lanes.mjs`
- `src/batch/reconcile.mjs`
- `src/batch/worker-host.mjs` (orphan handoff only if needed)
- `src/batch/resume-multi.mjs`
- `tests/batch/worker-orphan-final-review.test.mjs` (new)
- `docs/adoption/operator-runbook.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/engine-lanes.mjs`, `src/batch/reconcile.mjs`, `tests/batch/worker-orphan-final-review.test.mjs` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Reconstruct SP-209 / SP-211 journal ordering (worker death → review.started → orphan diagnose)
- [ ] Map gap vs SP-203 (engine PID kill on resume)

### Step 1: Orphan → engine review handoff

> **Plan-review checkpoint**

- [ ] Implement recovery path when worker pid dead but deliverables present
- [ ] Update diagnose suggestedCommand when auto-recovery is possible vs blocked

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Fixture: dead workerPid + worktree `.DONE` + code APPROVE → task completes without pause/resume
- [ ] Fixture: dead workerPid without `.DONE` → still `needs_retry` / failed (fail closed)
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Runbook SAT-020 / worker_orphaned recovery tree update
- [ ] Append resolved entry to `findings.md`
- [ ] Create `.DONE`

## Completion Criteria

- [ ] SP-209/211-shaped orphans complete land loop without operator `pause` + `resume --force`
- [ ] Diagnosis remains `worker_orphaned` when recovery blocked (no false success)
- [ ] No duplicate review spawns when verdicts already honored
- [ ] Tests green

## Git Commit Convention

- `feat(SP-229): complete Step N — description`

## Do NOT

- Mark task succeeded without `.DONE` and required contract/review gates
- Kill live worker pids on non-orphan stalls
- Bypass integrate gate or operator approve

---

## Amendments (Added During Execution)
