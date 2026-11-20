# Task: SP-879 — Worker: pi --mode json usage into task metric fields

**Created:** 2026-11-19
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Worker metrics stay empty without a producer; wrong wiring could invent usage on stubs.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** buildWorkerPiArgs uses -p --no-session without --mode json; spawnSync discards structured usage; buildTaskMetricRecord only copies finite task.tokens*.

## Mission

Partial #338 — Wire worker pi JSON usage into task metric fields.

1. **Argv** — Add `--mode json` in `buildWorkerPiArgs` (keep human-readable log tee via parser text extraction or dual handling).
2. **Persist** — After successful pi run, parse stdout with SP-878 helper; set `task.tokensIn`/`tokensOut`/`estimatedUsd` (or a sidecar the engine reads) before `recordLaneTaskMetric`.
3. **Stubs/execute** — Omit usage fields (no invented costs).
4. **Tests** — Fixture-driven or mocked stdout → metric record includes usage.
5. **Requires** SP-878.

## Dependencies

- **Task:** SP-878 (pi-json-usage parser)

## Context to Read First

- GitHub #338
- `bin/spine-worker-runner.mjs` buildWorkerPiArgs + spawnSync
- `src/batch/pi-json-usage.mjs` (SP-878)
- `src/batch/metrics.mjs` buildTaskMetricRecord
- Parent split: SP-878 / SP-879 / SP-880

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `bin/spine-worker-runner.mjs`
- `src/batch/engine-lanes/queue.mjs`
- `tests/batch/worker-usage-metrics.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/worker-usage-metrics.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-879` |
| fileScopeMustChange | `tests/batch/worker-usage-metrics.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-878 API
- [ ] Trace worker → recordLaneTaskMetric path

### Step 1: Worker JSON + attach usage

- [ ] --mode json
- [ ] Parse + set task usage before metric

### Step 2: Tests

- [ ] Mock/fixture stdout → tokens on task record
- [ ] Stub omits fields

### Step 3: Testing & Verification

- [ ] Run Contract testCommand
- [ ] Fix failures

### Step 4: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create .DONE

- [ ] Create `spine-tasks/SP-879-worker-json-usage-metrics/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (metrics / plan-review sections when relevant)

## Completion Criteria

- [ ] Confirm SP-878 API
- [ ] Trace worker → recordLaneTaskMetric path
- [ ] --mode json
- [ ] Parse + set task usage before metric
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `feat(SP-879): worker json usage metrics (Partial #338)`

## Do NOT

- Change reviewer spawn (SP-880)
- Invent usage for stub/execute
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- 2026-11-20: Redirect `fileScopeMustChange` to `tests/batch/worker-usage-metrics.test.mjs` only — `bin/spine-worker-runner.mjs` already landed on main via SP-877 (prelanded-file-scope). Worker may still edit worker-runner for usage wiring.
