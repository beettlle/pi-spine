# Task: SP-687 — Wire runQuotaProbes into spine metrics quota

**Created:** 2026-07-25
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Connect existing probe adapters to the CLI entrypoint; low novelty, single-module blast radius.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 1, Reversibility: 0

## Mission

Closes #237 — Make `spine metrics quota` call `runQuotaProbes` and pass `probeResults` into `buildQuotaSnapshot` so `snapshotSource: "live"` is reachable when credentials and probes succeed. Fail closed to estimate/absent on probe failure. Update `docs/QUICK-REFERENCE.md` so `live` is documented as probe enrichment, not a future placeholder.

**Hard requirement:** Do not leave helpers unused — production CLI must invoke probes (lesson from abandoned v3).

## Dependencies

- **None**

## Context to Read First

- `src/metrics/quota-cli.mjs` — `runQuotaReport` (missing probe call)
- `src/metrics/quota-probes.mjs` — `runQuotaProbes`
- `src/metrics/quota-snapshot.mjs` — `probeResults` merge
- `bin/spine.mjs` — metrics quota handler (~L217)
- `tests/metrics/quota-cli.test.mjs`
- `docs/QUICK-REFERENCE.md` — `live` wording (~L508)
- GitHub #237

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/metrics/quota-cli.mjs`
- `bin/spine.mjs`
- `tests/metrics/quota-cli.test.mjs`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/metrics/quota-cli.test.mjs` |
| fileScopeMustChange | `src/metrics/quota-cli.mjs`, `tests/metrics/quota-cli.test.mjs`, `docs/QUICK-REFERENCE.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm `runQuotaReport` builds snapshot without `probeResults`
- [ ] Confirm `bin/spine.mjs` treats `runQuotaReport` as sync
- [ ] Confirm QUICK-REFERENCE still says `live` is future/reserved

### Step 1: Wire probes into quota CLI

- [ ] Make `runQuotaReport` async (or add async entrypoint used by CLI)
- [ ] Before `buildQuotaSnapshot`, `await runQuotaProbes({ authPath })` (or project-resolved auth path)
- [ ] Pass `probeResults` into `buildQuotaSnapshot`
- [ ] Await the async entrypoint from `bin/spine.mjs` metrics quota handler
- [ ] Probe failure degrades to estimate/absent — never invent limits or keys in output

### Step 2: Testing & Verification

- [ ] Add CLI/integration coverage: mocked fetch + fixture auth → `snapshotSource: "live"` for at least one pool
- [ ] Assert no API keys or prompt bodies in JSON output
- [ ] Run contract `testCommand` only (scoped) — do **not** run full `npm test` or `npm run coverage:check` in the lane
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Update `docs/QUICK-REFERENCE.md`: `live` = probe succeeded (not future placeholder)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/QUICK-REFERENCE.md` — `live` source wording

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — quota probe section

## Completion Criteria

- [ ] Production path calls `runQuotaProbes` (not tests-only)
- [ ] `spine metrics quota --json` can emit `snapshotSource: "live"` under mocked success
- [ ] Fail-closed on probe errors
- [ ] QUICK-REFERENCE documents `live` as probe enrichment

## Do NOT

- Invent pool limits when probes fail
- Log or emit API keys / secrets
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-687): wire runQuotaProbes into metrics quota CLI (#237)`
