# Task: SP-837 — Reviewer rows in run-metrics (model, verdict, attempts)

**Created:** 2026-10-17
**Size:** M

## Review Level: 1 (Plan Only)

**Risk:** run-metrics feeds `spine metrics show`, quota estimates and doctor. A record that old readers reject breaks those commands.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** `buildTaskMetricRecord` (`src/batch/metrics.mjs` 121-181) writes `agentRole: "worker"` rows only; the single caller is `recordLaneTaskMetric` (`src/batch/engine-lanes/queue.mjs` 29-39). Reviewer outcomes exist only in the journal: verdicts are recorded in `runReviewPollLoop` (`src/batch/engine-lanes/review-poll.mjs` — spawn failure ~329-354, `task.verdict_recorded` ~360-370 with `[attemptKey]: reviewAttempt + 1`, PASS ~372-376, REPLAN ~378, REVISE/exhaustion ~397-420, honored artifact ~205-221). `finalVerdict` is never set on the task (`review-final.mjs` 205-221 puts it only in the `task.failed` payload). `src/metrics/quota-snapshot.mjs` filters `recordType === "task"` (~198), so Google reviewer usage never counts toward the pool (#351 comment). After SP-834, the per-task review `config` passed into review phases carries the effective reviewer pins.

## Mission

Closes #325 — Record one `recordType: "review"` row per reviewer verdict or reviewer failure, group them in `spine metrics show`, and count them in quota estimates.

1. **Record builder** — in `src/batch/metrics.mjs` add `buildReviewMetricRecord({ batchId, taskId, laneNumber, reviewType, stepNumber, model, thinking, profile, verdict, attempt, durationMs, outcome, failureReason })` and `appendReviewMetric(projectRoot, record, config)` reusing the existing append + `sanitizeMetricRecord` path. Fields: `recordType: "review"`, `schemaVersion: 1`, `agentRole: "reviewer"`, `role: "reviewer"`, `endedAt`; `outcome` is `verdict` | `spawn_failed` | `timeout` | `provider_error` | `blocked`. `model` / `thinking` come from `resolveReviewerModelPin` / `resolveReviewerThinkingPin` on the config the review ran with (`"inherit"` when null). Respect `metrics.enabled`.
2. **Emit** in `runReviewPollLoop`: one row per recorded verdict (APPROVE/PASS/REVISE/REPLAN) with `attempt` = the 1-based attempt index, and one row per spawn failure / timeout / provider error. A REVISE then PASS yields two rows with attempts 1 and 2. Also emit `outcome: "blocked"` rows for SP-834's `review.blocked` path if it is reachable from the poll loop (otherwise from the engine call site that journals it — record which in Discoveries).
3. **`finalVerdict`** — set `task.finalVerdict` on PASS and REVISE paths in `src/batch/engine-lanes/review-final.mjs` so the existing worker record field is populated.
4. **Readers** — `src/batch/metrics-rollup.mjs`: add a `reviews` rollup grouped by `(reviewType, model)` with counts per verdict, mean attempts and failure counts; `spine metrics show` (`bin/spine.mjs` ~170-215) prints it and includes it in `--json` `rollups`. `formatMetricsTable` keeps working with mixed record types. `src/metrics/quota-snapshot.mjs` counts `recordType === "review"` rows toward `observedModels` and pool usage (task counts unchanged). All readers tolerate records without the new fields.

## Dependencies

- **Requires:** SP-834 (per-task review config with effective reviewer pins)
- **Requires:** SP-835 (`src/batch/metrics.mjs` edits — same file, serialize)

## Context to Read First

- GitHub #325 (Proposal option 2 and Acceptance criteria)
- `src/batch/metrics.mjs` (whole file)
- `src/batch/engine-lanes/review-poll.mjs` 190-430
- `src/batch/engine-lanes/review-final.mjs` 195-230, 330-345
- `src/batch/metrics-rollup.mjs`; `bin/spine.mjs` 165-220
- `src/metrics/quota-snapshot.mjs` 150-250
- `tests/batch/run-metrics.test.mjs`, `tests/metrics/quota-snapshot.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/metrics.mjs`
- `src/batch/engine-lanes/review-poll.mjs`
- `src/batch/engine-lanes/review-final.mjs`
- `src/batch/metrics-rollup.mjs`
- `bin/spine.mjs`
- `src/metrics/quota-snapshot.mjs`
- `tests/batch/review-run-metrics.test.mjs`
- `tests/batch/run-metrics.test.mjs`
- `tests/metrics/quota-snapshot.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/review-run-metrics.test.mjs tests/batch/run-metrics.test.mjs tests/metrics/quota-snapshot.test.mjs tests/metrics/quota-cli.test.mjs tests/batch/review-retry-reconcile.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-837` |
| fileScopeMustChange | `src/batch/metrics.mjs`, `src/batch/engine-lanes/review-poll.mjs`, `src/batch/metrics-rollup.mjs`, `tests/batch/review-run-metrics.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `runReviewPollLoop`, `buildTaskMetricRecord`, `rollupMetrics`, `buildQuotaSnapshot`
- [ ] `rg -n 'recordType' src tests` — record every reader that filters on it

### Step 1: Builder + emit points

- [ ] `buildReviewMetricRecord` / `appendReviewMetric`
- [ ] Rows on every verdict and reviewer failure; `finalVerdict` set

**Artifacts:**
- `src/batch/metrics.mjs` (modified)
- `src/batch/engine-lanes/review-poll.mjs` (modified)
- `src/batch/engine-lanes/review-final.mjs` (modified)

### Step 2: Readers

- [ ] `reviews` rollup in `metrics show` (table + `--json`)
- [ ] Quota snapshot counts reviewer models

**Artifacts:**
- `src/batch/metrics-rollup.mjs` (modified)
- `bin/spine.mjs` (modified)
- `src/metrics/quota-snapshot.mjs` (modified)

### Step 3: Tests

- [ ] Stub verdicts REVISE,PASS per review type → two rows, attempts 1 and 2, model/thinking from a profile-resolved config where worker and reviewer differ
- [ ] Spawn failure row
- [ ] Rollup groups by `(reviewType, model)`; old records without new fields still read
- [ ] Quota snapshot `observedModels` includes the reviewer model; `drift.missingModels` no longer lists it

**Artifacts:**
- `tests/batch/review-run-metrics.test.mjs` (new)
- `tests/batch/run-metrics.test.mjs` (modified)
- `tests/metrics/quota-snapshot.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-837-reviewer-run-metrics/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-837`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (metrics section)

## Completion Criteria

- [ ] Metrics identify model and thinking per review type; REVISE→PASS visible as two attempts
- [ ] `finalVerdict` populated; `spine metrics show` groups reviews by type and model
- [ ] Readers accept old records

## Git Commit Convention

- `feat(SP-837): reviewer rows in run-metrics (#325)`

## Do NOT

- Populate token/cost usage fields (#338)
- Change review verdict thresholds or rubrics
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
