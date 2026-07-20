# Task: SP-677 — Metrics show usage rollups

**Created:** 2026-07-20
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** CLI rollups over existing JSONL; prefer new helper module to limit blast radius on `metrics.mjs`.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #208 — Extend `spine metrics show` (and `--json`) with rollups by batch, model, and agent role when usage fields are present. Missing usage stays clean (omit / null totals). Preserve redaction. Prefer extracting rollup helpers into `src/batch/metrics-rollup.mjs` so SP-676’s writer changes stay isolated.

## Dependencies

- **Task:** SP-676 (usage fields + sanitize must land first)

## Context to Read First

- `src/batch/metrics.mjs` — read/filter/format helpers
- `bin/spine.mjs` — `cmdMetrics`
- `tests/batch/run-metrics.test.mjs`
- `Parent split: SP-676 — usage field write path`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/metrics-rollup.mjs`
- `src/batch/metrics.mjs`
- `bin/spine.mjs`
- `tests/batch/run-metrics.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/run-metrics.test.mjs` |
| fileScopeMustChange | `src/batch/metrics-rollup.mjs`, `bin/spine.mjs`, `tests/batch/run-metrics.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-676 usage field names on `main`
- [ ] Review current `spine metrics show` table/`--json` shapes

### Step 1: Rollup helpers

- [ ] Add `src/batch/metrics-rollup.mjs` with batch/model/role aggregations
- [ ] Handle missing usage without inventing zeros-as-cost unless explicitly documented as “unknown”
- [ ] Unit tests for present vs missing usage

### Step 2: CLI surface

- [ ] Wire rollups into `spine metrics show` human table and `--json`
- [ ] Keep existing filters (`--batch`, `--last`) working
- [ ] Help text mentions usage rollups when data present

### Step 3: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 4: Documentation & Delivery

- [ ] Create `.DONE` (QUICK-REFERENCE in SP-682)

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` — SP-682

## Completion Criteria

- [ ] Rollups work when usage present
- [ ] Closes #208 with SP-676
- [ ] No secrets in output

## Do NOT

- Require pricing tables from other packages
- Break existing metrics show consumers
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-677): metrics show usage rollups (#208)`
