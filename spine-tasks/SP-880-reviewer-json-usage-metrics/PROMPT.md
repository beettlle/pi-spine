# Task: SP-880 — Reviewer: pi --mode json usage on review metric rows

**Created:** 2026-11-19
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Reviewer rows from SP-837 still lack tokens; operators cannot attribute cost by role.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** review-spawn uses text mode; buildReviewMetricRecord has no usage keys; rollups already support finite usage when present.

## Mission

Closes #338 — Attach pi JSON usage to reviewer metric rows and prove rollups end-to-end with a fixture.

1. **Argv** — `buildReviewerPiArgs` / spawn: `--mode json`; parse stream with SP-878; keep capped human logs.
2. **Records** — Extend `buildReviewMetricRecord` / `recordReviewMetric` to copy finite `tokensIn`/`tokensOut`/`estimatedUsd`.
3. **Emit** — Pass usage from spawn result into review metric append sites.
4. **Fixture** — `spine metrics show` (or rollup unit) populates byRole/byModel from fixture JSON stream records.
5. **Requires** SP-878. Completes #338 AC with SP-879.

## Dependencies

- **Task:** SP-878 (pi-json-usage parser)

## Context to Read First

- GitHub #338 Acceptance criteria
- `src/batch/review-spawn.mjs`
- `src/batch/metrics.mjs` buildReviewMetricRecord
- `src/batch/pi-json-usage.mjs` (SP-878)
- SP-837 reviewer rows already exist
- Parent split: SP-878 / SP-879 / SP-880

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/review-spawn.mjs`
- `src/batch/metrics.mjs`
- `src/batch/engine-lanes/review-poll.mjs`
- `tests/batch/review-usage-metrics.test.mjs`
- `tests/batch/run-metrics.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/review-usage-metrics.test.mjs tests/batch/run-metrics.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-880` |
| fileScopeMustChange | `src/batch/review-spawn.mjs`, `src/batch/metrics.mjs`, `tests/batch/review-usage-metrics.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-878 API + SP-837 emit sites
- [ ] Impact on buildReviewMetricRecord

### Step 1: Reviewer JSON + metric fields

- [ ] --mode json + parse
- [ ] Usage on review metric records

### Step 2: Fixture rollup test

- [ ] End-to-end fixture → metrics show / rollup

### Step 3: Testing & Verification

- [ ] Run Contract testCommand
- [ ] Fix failures

### Step 4: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create .DONE

- [ ] Create `spine-tasks/SP-880-reviewer-json-usage-metrics/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (metrics / plan-review sections when relevant)

## Completion Criteria

- [ ] Confirm SP-878 API + SP-837 emit sites
- [ ] Impact on buildReviewMetricRecord
- [ ] --mode json + parse
- [ ] Usage on review metric records
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `feat(SP-880): reviewer json usage metrics (#338)`

## Do NOT

- Change worker spawn (SP-879)
- Invent usage when pi reports none
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
