# Task: SP-359 — Resume contract review before commit

**Created:** 2026-06-29
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Resume paths skip code/final review and contract verification after `batch retry` + `resume --force`, allowing review_exhausted tasks to merge without `contract.verified`.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #42**: batch `20260629T221839` — SP-358 failed final contract 3× on `fileScopeMustChange`, then retry merged without `contract.verified` or `review.started` because resume commits after worker without engine review phases.

**Required behavior:**

1. `resume.mjs` and `resume-multi-lanes.mjs` run `runCodeReviewPhase` + `runFinalReviewPhase` before `commitLaneWorktree` on resumed tasks.
2. `taskAlreadyComplete` returns false for `pending`/`failed`/`running` even when stale `.DONE` exists on disk.
3. Regression test: failed retry → resume → `review.started` or `contract.verified` before `task.completed`.

**Closes:** [#42](https://github.com/beettlle/pi-spine/issues/42)

## Dependencies

- **None**

## File Scope

- `src/batch/resume-lane-reviews.mjs` (new)
- `src/batch/resume-common.mjs`
- `src/batch/resume.mjs`
- `src/batch/resume-multi-lanes.mjs`
- `tests/batch/resume-lane-reviews.test.mjs` (new)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 SPINE_REVIEW_STUB=1 node --experimental-strip-types --test tests/batch/resume-lane-reviews.test.mjs` |
| fileScopeMustChange | `src/batch/resume-lane-reviews.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/resume-lane-reviews.test.mjs` |

## Steps

### Step 0: Preflight
- [ ] Read issue #42 and batch `20260629T221839` journal retry path

### Step 1: Wire resume review phases
- [ ] Add `runLaneReviewPhasesBeforeCommit` helper
- [ ] Call from single-lane and multi-lane resume before lane commit

### Step 2: Fix taskAlreadyComplete
- [ ] Return false for pending/failed/running despite stale `.DONE`

### Step 3: Testing & Verification
- [ ] Regression test passes
- [ ] FULL suite + coverage gate

### Step 4: Delivery
- [ ] Close issue #42
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Resume cannot succeed without review/contract on retry path
- [ ] Tests pass
- [ ] Issue #42 closed

## Do NOT

- Close #41 (detached land-loop — separate SP-358 scope)

---

## Amendments (Added During Execution)
