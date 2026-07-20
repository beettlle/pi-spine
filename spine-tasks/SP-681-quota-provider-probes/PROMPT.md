# Task: SP-681 — Optional quota provider probes

**Created:** 2026-07-20
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Optional adapters; fail closed; security-sensitive around auth.json.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 2, Reversibility: 0

## Mission

Closes #220 — Add optional provider probe adapters that enrich the quota snapshot when credentials allow (e.g. Z.ai / Kimi usage endpoints via `~/.pi/agent/auth.json`; Cursor Admin/Analytics only with explicit admin key). Degrade to `absent`/`estimate` on failure or non-Enterprise 403. Never invent remaining %. Never log or write secrets into reports.

## Dependencies

- **Task:** SP-678 (snapshot must accept optional probe results)

## Context to Read First

- `src/metrics/quota-snapshot.mjs`
- GitHub #220 degrade matrix
- `Parent split: SP-678 — snapshot builder`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (tests must not require live network)

## File Scope

- `src/metrics/quota-probes.mjs`
- `src/metrics/quota-snapshot.mjs`
- `tests/metrics/quota-probes.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/metrics/quota-probes.test.mjs` |
| fileScopeMustChange | `src/metrics/quota-probes.mjs`, `tests/metrics/quota-probes.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm snapshot extension points for probe results
- [ ] List degrade modes (`live` | `estimate` | `absent`)

### Step 1: Probe adapters

- [ ] Implement probe interface + stubbed adapters with fail-closed behavior
- [ ] Never scrape undocumented Cursor dashboard HTML
- [ ] Fixture tests with mocked responses (no live network in unit tests)

### Step 2: Snapshot integration

- [ ] Merge probe results into snapshot with explicit source mode
- [ ] Ensure redaction of credentials

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

- [ ] Probes optional and fail closed
- [ ] Closes #220 with SP-678–SP-680
- [ ] No live network required for tests

## Do NOT

- Require Enterprise Cursor for MVP usefulness
- Hard-depend on other beettlle packages
- Write secrets into `.spine/reports/`
- Modify `.spine/` config, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-681): optional quota provider probes (#220)`
