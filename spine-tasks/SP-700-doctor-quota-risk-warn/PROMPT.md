# Task: SP-700 — Doctor/preflight quota-risk escalate warning

**Created:** 2026-08-09
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** New advisory doctor check wired into existing doctor orchestration; uses metrics/quota signals.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0

## Mission

Closes #251 — Add an **advisory** doctor check (and therefore preflight surface via existing doctor aggregation) that warns when hard-profile / escalate worker targets are known quota-constrained providers without headroom, or when recent run-metrics show launch-storm / quota-abort patterns. Prefer existing `resolvePoolId` / `runQuotaProbes` / run-metrics readers (NFR-OBS-04). Must return `ok: true, warning: true` when risk is detected — **never** `ok: false` — so preflight stays non-blocking. Document the advisory nature briefly in `skills/spine-release-operator/SKILL.md` (cross-link #251).

## Dependencies

- **None**

## Context to Read First

- `src/doctor/attached-orphan-risk.mjs` — advisory `ok: true, warning: true` pattern
- `src/doctor/run-doctor-checks.mjs` — where checks are registered
- `src/metrics/quota-snapshot.mjs` / `src/metrics/quota-probes.mjs` — pool + probe APIs
- `tests/doctor/model-id-validation.test.mjs` — doctor unit test style
- GitHub #251, #248
- Manifest: `spine-tasks/_authoring/release-v2.13.0/manifest.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/doctor/quota-risk.mjs`
- `src/doctor/run-doctor-checks.mjs`
- `tests/doctor/quota-risk.test.mjs`
- `skills/spine-release-operator/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/doctor/quota-risk.test.mjs` |
| fileScopeMustChange | `src/doctor/quota-risk.mjs`, `src/doctor/run-doctor-checks.mjs`, `tests/doctor/quota-risk.test.mjs`, `skills/spine-release-operator/SKILL.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm advisory doctor pattern (`ok: true, warning: true`) in attached-orphan-risk
- [ ] Confirm preflight fails only on `!entry.ok` doctor rows (warnings must not fail)

### Step 1: Implement quota-risk doctor check

- [ ] Add `src/doctor/quota-risk.mjs` exporting a builder (e.g. `buildQuotaRiskDoctorCheck`) that inspects config hard/escalate worker pins + optional mocked metrics/probe inputs
- [ ] Treat known quota-constrained provider prefixes (at least `kimi-coding`, and others already in pool model) without live/estimate headroom as warn; degrade closed when probes/auth absent
- [ ] Optionally surface recent launch-storm / quota-abort signals from run-metrics when injectable
- [ ] Register the check in `run-doctor-checks.mjs`
- [ ] Unit tests with mocked config/metrics/probe inputs covering warn and clear paths
- [ ] Brief skill note: advisory doctor/preflight quota-risk signal (#251); still ban mid-release pin thrash

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Confirm warning path returns `ok: true` with `warning: true`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `skills/spine-release-operator/SKILL.md`

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — only if skill cross-link insufficient

## Completion Criteria

- [ ] Doctor surfaces advisory quota-risk warning for escalate/hard pins without headroom
- [ ] Preflight remains non-blocking for this check (`ok: true` when warning)
- [ ] Tests cover warn + clear paths with mocks
- [ ] Skill documents advisory #251 signal

## Do NOT

- Make the check hard-fail doctor/preflight by default
- Mid-release edit `.spine/spine-config.json` agent pins as part of this task
- Scrape undocumented provider dashboards
- Invent remaining quota percentages
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-700): doctor advisory quota-risk escalate warning (#251)`
