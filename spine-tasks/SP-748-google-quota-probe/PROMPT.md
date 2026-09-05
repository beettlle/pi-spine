# Task: SP-748 — Optional Google quota probe for metrics quota

**Created:** 2026-09-05
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** New optional network probe; must stay fail-closed (no invented limits; no secrets in output). Wrong credential class must yield `absent`.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 1, Reversibility: 0

## Mission

Closes #277 — Add an optional fail-closed Google pool probe so `spine metrics quota` can report `source: "live"` for `google/*` when credentials and a public Google AI / Gemini usage (or quota) API succeed. Follow the same degrade matrix as existing Z.ai/Kimi/Anthropic probes. If no suitable public API exists for the consumer key class pi stores, document that in STATUS + QUICK-REFERENCE and close with a permanent fail-closed `absent` path (won't-fix scrape) — do **not** invent dashboard scrapers.

## Dependencies

- **None**

## Context to Read First

- GitHub #277 — Google probe brief (follow-up to #238)
- `src/metrics/quota-probes.mjs` — `PROBE_POOLS`, existing probes
- `src/metrics/quota-snapshot.mjs` — `POOL_PREFIXES` / google pool
- `tests/metrics/quota-probes.test.mjs`
- `docs/QUICK-REFERENCE.md` — Probe credential classes / degrade matrix

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (mocked `fetch` in tests)

## File Scope

- `src/metrics/quota-probes.mjs`
- `src/metrics/quota-snapshot.mjs`
- `tests/metrics/quota-probes.test.mjs`
- `tests/metrics/quota-snapshot.test.mjs`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/metrics/quota-probes.test.mjs tests/metrics/quota-snapshot.test.mjs tests/metrics/quota-cli.test.mjs` |
| fileScopeMustChange | `src/metrics/quota-probes.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm public Google usage/quota API for the auth.json key class (or document none)
- [ ] Map `PROBE_POOLS` / `runQuotaProbes` wiring and google prefix in snapshot

### Step 1: Implement fail-closed probeGoogle

- [ ] Add Google probe wired into `PROBE_POOLS` / `runQuotaProbes`
- [ ] Wrong/missing credentials → `absent` without calling with the wrong key class
- [ ] Map explicit usage/limit fields only when present; never invent remaining %
- [ ] Redact secrets from all probe outputs

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures
- [ ] Tests: live success (mocked), 401/403, missing key, OK without limit fields

### Step 3: Documentation & Delivery

- [ ] Document Google credential class + degrade row in `docs/QUICK-REFERENCE.md`
- [ ] If no public API: STATUS records research conclusion; probe stays `absent` with documented rationale
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/QUICK-REFERENCE.md` — Google probe credential class + degrade matrix row

**Check If Affected:**

- `docs/adoption/operator-runbook.md` — only if metrics quota section references probe pools

## Completion Criteria

- [ ] Optional Google probe follows fail-closed rules
- [ ] `spine metrics quota` can show google `source: "live"` when probe succeeds **or** documented permanent `absent` with no scrape
- [ ] Wrong/missing credentials → `absent`
- [ ] Tests cover live / absent / no-limit paths (mocked)
- [ ] QUICK-REFERENCE updated
- [ ] Closes #277
- [ ] `.DONE` created

## Do NOT

- Scrape undocumented Google dashboards or HTML consoles
- Invent usage/limit numbers when the API omits them
- Print API keys or tokens in CLI/JSON output
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `feat(SP-748): optional Google quota probe (#277)`
