# Task: SP-702 — Optional anthropic/copilot probes + QUICK-REFERENCE

**Created:** 2026-08-09
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Fail-closed optional probes + credential docs; depends on SP-701 pool IDs.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0

## Mission

Closes #238 — Add optional fail-closed quota probe adapters for `anthropic` and `github-copilot` pools following the same rules as Z.ai / Kimi / Cursor (no invented limits; no secrets in output; degrade to `source: "absent"`). Document credential classes and the degrade matrix in `docs/QUICK-REFERENCE.md` (inference key vs Admin key vs GitHub PAT with billing/enterprise scope). Do **not** scrape undocumented dashboards. Google probe remains out of scope.

## Dependencies

- **Task:** SP-701 (pool IDs for anthropic + github-copilot must exist)

## Context to Read First

- `Parent split: SP-701 — pool ID mapping only`
- `src/metrics/quota-probes.mjs` — existing adapters + `PROBE_POOLS` / `runQuotaProbes`
- `tests/metrics/quota-probes.test.mjs`
- `docs/QUICK-REFERENCE.md` — where credential/degrade docs go
- GitHub #238

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/metrics/quota-probes.mjs`
- `tests/metrics/quota-probes.test.mjs`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/metrics/quota-probes.test.mjs` |
| fileScopeMustChange | `src/metrics/quota-probes.mjs`, `tests/metrics/quota-probes.test.mjs`, `docs/QUICK-REFERENCE.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-701 landed: `resolvePoolId` maps anthropic + github-copilot
- [ ] Read existing probe fail-closed patterns (missing auth, 403, network)

### Step 1: Probes + docs

- [ ] Add optional Anthropic Admin rate-limits probe path (Admin key only); degrade when missing/unsuitable key
- [ ] Add optional GitHub Copilot usage/billing probe path requiring enterprise/org context; degrade without scope
- [ ] Extend `PROBE_POOLS` / `runQuotaProbes` selection without inventing remaining %
- [ ] Unit tests with mocked fetch/auth covering live + absent paths; assert no secrets in results
- [ ] Document credential classes + degrade matrix in `docs/QUICK-REFERENCE.md`

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/QUICK-REFERENCE.md`

**Check If Affected:**
- `src/metrics/quota-cli.mjs` — only if probe registration requires CLI wiring beyond `runQuotaProbes`

## Completion Criteria

- [ ] Optional anthropic + github-copilot probes fail closed
- [ ] No secrets in probe results
- [ ] QUICK-REFERENCE documents credential classes and degrade matrix
- [ ] #238 acceptance criteria met

## Do NOT

- Require undocumented dashboard scraping
- Invent remaining quota limits
- Block on a Google probe (explicit out of scope)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-702): anthropic/copilot quota probes and credential docs (#238)`
