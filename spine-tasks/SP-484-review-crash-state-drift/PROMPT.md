# Task: SP-484 — State drift: engine crash after review.started leaves task stuck

**Created:** 2026-07-03
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Touches engine lane lifecycle, review phase, and journal rebuild — core orchestration paths. Incorrect fix risks silent data loss or double-completion. Multiple modules affected.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Canonical Task Folder

```
spine-tasks/SP-484-review-crash-state-drift/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

When the batch engine terminates mid-flight after a `review.started` event but before `review.completed` and `task.completed` are journaled, the task remains stuck as `status: "running"` in `batch-state.json` — even though `.DONE` exists and a review artifact with `Verdict: APPROVE` is on disk. The reconciler detects `state_drift` but cannot self-heal without manual `spine batch retry --force`.

Fix three things:
1. **Resume-time artifact reconciliation:** On `spine batch resume`, detect orphaned `review.started` events (no matching `review.completed`) and check if the artifact file exists on disk with a valid verdict. If so, synthesize the missing `review.completed` + `task.completed` events.
2. **Relax the `codeReviewAttempt === 0` guard:** Allow `findCompletedCodeReview` to honor existing artifacts regardless of attempt count, so resume picks up where the engine left off.
3. **Engine crash guard:** Before engine exit, flush pending state transitions for tasks that have review artifacts on disk but no `review.completed` event.

**Closes:** [#131](https://github.com/beettlle/pi-spine/issues/131)

## Dependencies

- **None**

## Context to Read First

**Tier 3 (load only if needed):**
- `src/batch/engine-lanes.mjs` — `runTaskOnLane` review→commit→complete flow (lines 233–321)
- `src/batch/engine-lanes/review.mjs` — `runCodeReviewPhase` with `findCompletedCodeReview` honor path (lines 407–500)
- `src/batch/journal-rebuild.mjs` — `detectBatchStateDrift()` reconciliation
- `docs/incidents/20260605-retry-state-drift.md` — prior state drift fix (SP-120)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes.mjs`
- `src/batch/engine-lanes/review.mjs`
- `src/batch/journal-rebuild.mjs`
- `tests/batch/review-crash-recovery.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run coverage:check` |
| fileScopeMustChange | `src/batch/engine-lanes/review.mjs`, `src/batch/journal-rebuild.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/review-crash-recovery.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required source files exist
- [ ] Read `runTaskOnLane` flow and identify the review→complete gap
- [ ] Read `findCompletedCodeReview` and confirm the `codeReviewAttempt === 0` guard
- [ ] Understand journal rebuild's `detectBatchStateDrift` classification logic

### Step 1: Relax findCompletedCodeReview attempt guard

- [ ] In `review.mjs`, modify `findCompletedCodeReview` to check for existing artifacts regardless of `codeReviewAttempt` value
- [ ] Ensure the honor path logs clearly when it finds a pre-existing artifact for attempt > 0
- [ ] Run targeted tests: `npm test -- tests/batch/review`

**Artifacts:**
- `src/batch/engine-lanes/review.mjs` (modified)

### Step 2: Add resume-time orphan detection

- [ ] In `journal-rebuild.mjs`, add logic to detect orphaned `review.started` events with no `review.completed`
- [ ] When orphaned review detected, check disk for review artifact with valid verdict
- [ ] If artifact exists with APPROVE/PASS, synthesize `review.completed` + `task.completed` events during rebuild
- [ ] Log synthesized events clearly for operator audit trail
- [ ] Run targeted tests: `npm test -- tests/batch/journal`

**Artifacts:**
- `src/batch/journal-rebuild.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Add test: orphaned review.started with APPROVE artifact on disk → resume synthesizes completion
- [ ] Add test: orphaned review.started with no artifact on disk → remains stuck (no false positive)
- [ ] Add test: findCompletedCodeReview honors artifact at attempt > 0
- [ ] Add test: normal review flow (no crash) still works correctly (regression)
- [ ] Fix all failures

**Artifacts:**
- `tests/batch/review-crash-recovery.test.mjs` (new)

### Step 4: Documentation & Delivery

- [ ] Update operator runbook with `state_drift` after review.started diagnosis and fix
- [ ] Link to incident doc if applicable
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — add review-crash state_drift diagnosis

**Check If Affected:**
- `docs/incidents/20260605-retry-state-drift.md` — cross-reference this fix

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `spine batch resume` auto-heals tasks stuck after review.started crash
- [ ] `findCompletedCodeReview` honors artifacts at any attempt count
- [ ] No regression in normal review flow
- [ ] Documentation updated

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-484): complete Step N — description`
- **Bug fixes:** `fix(SP-484): description`
- **Tests:** `test(SP-484): description`
- **Hydration:** `hydrate: SP-484 expand Step N checkboxes`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Synthesize completion events without verifying artifact verdict (APPROVE/PASS only)

---

## Amendments (Added During Execution)
