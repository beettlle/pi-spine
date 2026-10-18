# Task: SP-840 — Engine code review diffs against the task start commit

**Created:** 2026-10-17
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** The baseline SHA flows into git argv and the reviewer prompt; an unvalidated value is an option-injection vector (#313).
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 1, Reversibility: 0
**Problem theory:** `runEngineCodeReview` (`src/batch/engine-lanes/review-code.mjs` ~109-116) calls `runStepReview` without `baseline`. `buildReviewRequest` (`src/batch/review-step.mjs` 163-164) then tells the reviewer to run `git diff --name-only` / `git diff` (uncommitted changes only), and `resolveCodeReviewScopePaths` (`src/batch/review-scope.mjs` 75-76) returns `[]`. Workers commit per step, so the reviewer sees an empty diff, returns REVISE, and the task ends `review_exhausted`. `runStepReview` (`src/batch/review-step-run.mjs` 68, 125, 219) already forwards `baseline`. `resolveTaskStartCommit` (`src/batch/contract-task-start.mjs` 181-210) resolves the start commit (task.started payload → prior `lane.committed` → `git rev-list -1 --before`) and is used by final-review contract verify (`review-final.mjs` 283-289). `runReviewPollLoop` supports `beforeReview` → `extraReviewParams` (`review-poll.mjs` 313-326). No SHA validator exists in `src/`.

## Mission

Closes #343 — Engine code reviews receive the task start commit as `baseline`, so committed step work is reviewed.

1. **Validator** — export `isValidCommitSha(value)` from `src/batch/contract-task-start.mjs`: `/^[0-9a-f]{7,40}$/i`, rejects leading `-`. `resolveTaskStartCommit` returns `null` for values that fail it.
2. **Wire** — in `runCodeReviewPhase` (`review-code.mjs`, which has `projectRoot`, `batchId`, `task`, `lane`, `wt`), resolve the start commit once with `resolveTaskStartCommit({ journal: readJournalEvents(projectRoot, batchId), taskId, laneId: lane.laneId, batchId, worktreePath: wt })`, pass it via `beforeReview` / `extraReviewParams: { baseline }`, and have `runEngineCodeReview` forward `baseline` to `runStepReview`. When it resolves to `null`, journal `review.baseline_missing` `{ taskId, reviewType: "code" }` (register in `src/batch/journal.mjs`) and keep today's behavior.
3. Keep `buildReviewRequest`'s `git diff ${baseline}..HEAD` form unchanged.

## Dependencies

- **None**

## Context to Read First

- GitHub #343
- `src/batch/engine-lanes/review-code.mjs` (whole file)
- `src/batch/contract-task-start.mjs` (whole file)
- `src/batch/engine-lanes/review-final.mjs` 275-295
- `src/batch/engine-lanes/review-poll.mjs` 300-330
- `src/batch/review-step.mjs` 150-175; `src/batch/review-scope.mjs` 60-90
- `tests/batch/review-retry-reconcile.test.mjs`, `tests/batch/contract-task-start.test.mjs`, `tests/batch/review-scope.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/engine-lanes/review-code.mjs`
- `src/batch/contract-task-start.mjs`
- `src/batch/journal.mjs`
- `tests/batch/review-code-baseline.test.mjs`
- `tests/batch/contract-task-start.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/review-code-baseline.test.mjs tests/batch/contract-task-start.test.mjs tests/batch/contract-resume-baseline.test.mjs tests/batch/review-retry-reconcile.test.mjs tests/batch/review-scope.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-840` |
| fileScopeMustChange | `src/batch/engine-lanes/review-code.mjs`, `src/batch/contract-task-start.mjs`, `tests/batch/review-code-baseline.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `runCodeReviewPhase`, `runEngineCodeReview`, `resolveTaskStartCommit`
- [ ] Confirm `src/batch/journal.mjs` registration pattern (SP-834/835 also add events there — append only)

### Step 1: Validator + wiring

- [ ] `isValidCommitSha`; invalid start commits resolve to `null`
- [ ] Code review receives `baseline`; `review.baseline_missing` when unresolved

**Artifacts:**
- `src/batch/contract-task-start.mjs` (modified)
- `src/batch/engine-lanes/review-code.mjs` (modified)
- `src/batch/journal.mjs` (modified)

### Step 2: Tests

- [ ] Committed step work with a clean tree: review request contains `git diff <sha>..HEAD`; scope paths non-empty
- [ ] `--evil` / non-hex start commit rejected → `review.baseline_missing`
- [ ] Validator table

**Artifacts:**
- `tests/batch/review-code-baseline.test.mjs` (new)
- `tests/batch/contract-task-start.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-840-code-review-baseline/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-840`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] Engine code reviews see committed step work
- [ ] Baseline SHA validated before reaching git argv or the prompt

## Git Commit Convention

- `fix(SP-840): give engine code review a task-start baseline (#343)`

## Do NOT

- Change plan or final review baselines
- Change `buildReviewRequest` diff form
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
