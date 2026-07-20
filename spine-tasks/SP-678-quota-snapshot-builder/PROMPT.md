# Task: SP-678 — Quota snapshot builder

**Created:** 2026-07-20
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** New metrics/quota module; joins config + run-metrics; no secrets in snapshot.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 2, Security: 1, Reversibility: 0

## Mission

Partial #220 — Build a privacy-safe quota/headroom **snapshot** from `spine-config` agent role→model mapping and `.spine/run-metrics.jsonl` observed burn. Map provider prefixes to shared quota pools. Support source modes `live` | `estimate` | `absent` with honest unknowns. Prefer duration-based attribution when usage fields are missing; consume SP-676 usage fields when present. Do not invent remaining %.

## Dependencies

- **Task:** SP-676 (prefer usage fields; duration-only must still work if usage absent)

## Context to Read First

- GitHub #220 proposed solution §1–2
- `src/batch/metrics.mjs`
- `.spine/spine-config.json` agents section shape
- `Parent split: SP-676 — usage fields`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/metrics/quota-snapshot.mjs`
- `tests/metrics/quota-snapshot.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/metrics/quota-snapshot.test.mjs` |
| fileScopeMustChange | `src/metrics/quota-snapshot.mjs`, `tests/metrics/quota-snapshot.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm metrics field names from SP-676
- [ ] Sketch pool mapping for `zai/*`, `kimi-coding/*`, `google/*`, `cursor/*`

### Step 1: Snapshot schema + join

- [ ] Implement `buildQuotaSnapshot({ projectRoot, config, metricsLines, now })`
- [ ] Join expected role→model from config with observed burn from metrics
- [ ] Surface config-vs-observed drift
- [ ] Never include API keys, prompt bodies, or auth file contents

### Step 2: Tests

- [ ] Fixture tests for join + unknown pools + missing usage
- [ ] Assert no secret-like keys in snapshot JSON

### Step 3: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` — SP-682

## Completion Criteria

- [ ] Snapshot builder tested and secret-free
- [ ] Partial #220 core join complete
- [ ] Works without live provider probes

## Do NOT

- Scrape undocumented Cursor dashboards
- Hard-depend on other beettlle packages
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-678): quota snapshot builder (#220)`
