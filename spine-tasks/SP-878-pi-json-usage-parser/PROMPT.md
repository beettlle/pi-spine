# Task: SP-878 — Parse pi --mode json stream into usage totals

**Created:** 2026-11-19
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Wrong parse invents costs or drops real usage; shared by worker and reviewer producers.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 0
**Problem theory:** Workers/reviewers run pi text mode so usage is discarded. A pure parser over pi JSON events is the shared foundation before spawn wiring.

## Mission

Partial #338 — Add a pure helper that sums usage from a pi `--mode json` stream (no spawn changes).

1. **Module** — New `src/batch/pi-json-usage.mjs`: parse NDJSON/JSON events; sum input/output (and cache fields if present) into `tokensIn`/`tokensOut`; take `estimatedUsd` from `cost.total` when finite.
2. **Omit** — Return no usage fields when pi reports none (never invent costs).
3. **Text** — Optionally extract human-readable text segments for log tee (document API).
4. **Fixture tests** — Recorded stream fixture under `tests/fixtures/`; unit tests only.
5. **Do not** change worker/reviewer spawn (SP-879 / SP-880).

## Dependencies

- **None**

## Context to Read First

- GitHub #338 Proposed fix + Acceptance criteria
- `src/batch/metrics.mjs` USAGE_KEYS / buildTaskMetricRecord copy path
- pi 1.5.2 JSON event shape (verify against local pi docs or sample)
- Parent split: SP-878 / SP-879 / SP-880 for #338

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/pi-json-usage.mjs`
- `tests/batch/pi-json-usage.test.mjs`
- `tests/fixtures/pi-json-stream/`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/pi-json-usage.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-878` |
| fileScopeMustChange | `src/batch/pi-json-usage.mjs`, `tests/batch/pi-json-usage.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm pi JSON event fields for usage/cost
- [ ] Sketch helper API

### Step 1: Parser module + fixture

- [ ] Implement sumUsageFromPiJsonStream
- [ ] Add fixture + unit tests; omit when empty

### Step 2: Testing & Verification

- [ ] Run Contract testCommand
- [ ] Fix failures

### Step 3: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create .DONE

- [ ] Create `spine-tasks/SP-878-pi-json-usage-parser/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (metrics / plan-review sections when relevant)

## Completion Criteria

- [ ] Confirm pi JSON event fields for usage/cost
- [ ] Sketch helper API
- [ ] Implement sumUsageFromPiJsonStream
- [ ] Add fixture + unit tests; omit when empty
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `feat(SP-878): pi json usage parser (Partial #338)`

## Do NOT

- Change worker or reviewer spawn argv
- Invent token/cost values when absent
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
