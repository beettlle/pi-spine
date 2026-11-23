# Task: SP-884 — Fix live run-metrics tokensIn/tokensOut

**Created:** 2026-11-22
**Size:** M
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Wrong wiring leaves usage empty forever or invents tokens; blast radius is metrics/journal only.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** SP-878/879/880 shipped parser + sidecar + reviewer wiring, but live batches still record `withUsage: 0`. Likely sidecar write/read path, reviewer usage → metric record, or pi `--mode json` shape mismatch vs `sumUsageFromPiJsonStream`.

## Mission

Closes #377 — Real-pi worker and reviewer metric rows must carry `tokensIn` / `tokensOut` / `estimatedUsd` when pi reports usage (omit when absent). Fix the live path after SP-878–880; keep unit/fixture coverage aligned with the actual emit sites.

## Dependencies

- **None**

## Context to Read First

- GitHub #377
- `bin/spine-worker-runner.mjs` — `worker-usage.json` write
- `src/batch/engine-lanes/queue.mjs` — sidecar read → `task.tokens*`
- `src/batch/pi-json-usage.mjs` — `sumUsageFromPiJsonStream`
- `src/batch/metrics.mjs` — `buildReviewMetricRecord` / USAGE_KEYS
- `src/batch/engine-lanes/review-poll.mjs` (or current reviewer emit site)
- `tests/batch/worker-usage-metrics.test.mjs`, `tests/batch/review-usage-metrics.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit/stub tests; do not require live quota)

## File Scope

- `bin/spine-worker-runner.mjs`
- `src/batch/engine-lanes/queue.mjs`
- `src/batch/pi-json-usage.mjs`
- `src/batch/metrics.mjs`
- `src/batch/engine-lanes/review-poll.mjs`
- `tests/batch/worker-usage-metrics.test.mjs`
- `tests/batch/review-usage-metrics.test.mjs`
- `tests/batch/run-metrics.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/worker-usage-metrics.test.mjs tests/batch/review-usage-metrics.test.mjs tests/batch/run-metrics.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-884` |
| fileScopeMustChange | `src/batch/engine-lanes/queue.mjs`, `tests/batch/worker-usage-metrics.test.mjs`, `tests/batch/review-usage-metrics.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Trace worker sidecar write → queue read → metric row
- [ ] Trace reviewer usage → `buildReviewMetricRecord` emit
- [ ] Compare fixture JSON shapes to current pi `--mode json` docs/samples

### Step 1: Fix live usage plumbing

- [ ] Repair worker and/or reviewer path so finite usage lands on metric rows when present
- [ ] Preserve omit-when-absent behavior; no invented tokens
- [ ] Keep redaction / sidecar dirty exclusions intact (#380)

### Step 2: Tests

- [ ] Extend unit/fixture coverage for the fixed emit sites
- [ ] Assert worker and review records can carry usage keys when provided

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`
- [ ] Fix failures

### Step 4: Documentation & Delivery

- [ ] Note investigation finding in STATUS Discoveries
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (metrics / spend)

## Completion Criteria

- [ ] Live path fixed or root cause documented with code fix for the broken hop
- [ ] Tests prove usage fields populate when input usage exists
- [ ] Contract `testCommand` exits 0
- [ ] `.DONE` present

## Git Commit Convention

- `fix(SP-884): populate live run-metrics tokens from pi usage (#377)`

## Do NOT

- Invent tokens when pi reports none
- Remove sidecar or break #380 dirty exclusion
- Require live paid API calls in contract tests
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
- **2026-11-22:** `bin/spine-worker-runner.mjs` prelanded by maxBuffer fix `d26147ee`; removed from mustChange — still edit if usage sidecar path needs more changes.
