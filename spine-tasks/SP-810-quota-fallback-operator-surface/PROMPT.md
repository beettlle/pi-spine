# Task: SP-810 — Operator surface: diagnose + doctor quota fallback

**Created:** 2026-10-03
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** `spine status --diagnose` and the dashboard banner share these builders; doctor runs in preflight. Additive output only, but wrong text would mislead operators under the #248 pin policy.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** After SP-806–SP-809 the engine records `worker.quota_exhausted`, `batch.quota_fallback_applied`, `batch.quota_fallback_exhausted` and `state.resilience.quotaFallback`, but diagnose still says "worker died … retry or abort" and doctor ignores the fallback profile. `buildReconcileDiagnosisContext` (`src/batch/reconcile-diagnosis-context.mjs`) receives `signals.raw` (whole batch state), so the fallback can be read without editing `reconcile-batch.mjs` (at the 500-line cap). `buildBackground` / `buildAssessmentReason` live in `src/batch/diagnosis-handoff-packet.mjs` (16-71, 81). Journal hint priority is `extractJournalDiagnosisHints` (`src/batch/journal.mjs` ~422-442). Doctor: `collectQuotaPinTargets` (`src/doctor/quota-risk.mjs` 45-89) reads worker, active-profile and escalate-target pins only.

## Mission

Partial #329 — Operators see the quota situation and the active fallback in diagnose, and doctor checks the fallback profile.

1. **Diagnose context** (`src/batch/reconcile-diagnosis-context.mjs`): expose `quotaFallback` = `signals.raw?.resilience?.quotaFallback ?? null`, and `lastQuotaExhausted` = payload of the latest `worker.quota_exhausted` / `batch.quota_fallback_exhausted` journal event when the context already has journal events (follow how other journal-derived fields are read; do not add a second journal read if one is available).
2. **Background / assessment** (`src/batch/diagnosis-handoff-packet.mjs`):
   - Fallback active → Background line: `Quota fallback active: <exhaustedPool> exhausted (resets <resetAtRaw>, provider local time) → <toProfile> (<toModel>) since <at>, triggered by <triggerTaskId>` and a second line with the paste-ready manifest text: `Agent pin override: yes (<YYYY-MM-DD from at>, auto quota fallback <exhaustedPool> -> <toProfile>, batch <batchId>)`.
   - Failed task with `exitReason` `provider_quota_exhausted` and fallback not possible (exhausted event present or no fallback configured) → Assessment says the provider quota is exhausted and shows `resetAtRaw` (or "reset time unknown"), instead of implying an immediate retry will work.
   - `provider_overloaded` → Assessment: transient provider overload; retry is reasonable.
3. **Journal hints** (`src/batch/journal.mjs` `extractJournalDiagnosisHints` priority list + `summarizeJournalEvent` field picks): include `batch.quota_fallback_applied`, `batch.quota_fallback_exhausted`, `worker.quota_exhausted` with their key fields.
4. **Doctor** (`src/doctor/quota-risk.mjs`):
   - `collectQuotaPinTargets` adds `agents.profiles[agents.quotaFallbackProfile].worker.model` when set.
   - New advisory (warning, never failing preflight) when the fallback profile's worker pool equals the active worker pool: `agents.quotaFallbackProfile <name> uses the same quota pool (<pool>) as the active worker — fallback can never help`.
5. **Tests:**
   - new `tests/batch/diagnosis-quota-fallback.test.mjs`: context + background lines for active fallback (incl. manifest line), exhausted-without-fallback assessment with reset time, overloaded assessment, no fallback data → output identical to before for an existing failed-task fixture.
   - `tests/doctor/quota-risk.test.mjs`: fallback worker included in targets; same-pool warning; different pool → no warning; unset → unchanged.
   - Run the existing diagnosis tests listed in the Contract to guard regressions.

## Dependencies

- **Task:** SP-805 (`agents.quotaFallbackProfile` key)
- **Task:** SP-808 (`state.resilience.quotaFallback` shape, journal event payloads)

## Context to Read First

- GitHub #329 (Proposed solution §7, §8)
- `src/batch/engine-lanes/quota-fallback-state.mjs` (SP-808) — event names and payloads
- `src/batch/reconcile-diagnosis-context.mjs` (87 lines), `src/batch/diagnosis-handoff-packet.mjs` (148 lines)
- `src/batch/journal.mjs` 344 (`summarizeJournalEvent`), 422-442 (`extractJournalDiagnosisHints`)
- `src/doctor/quota-risk.mjs` 45-128, 196-229; `bin/spine-status.mjs` 83-135 (rendering, read-only)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/reconcile-diagnosis-context.mjs`
- `src/batch/diagnosis-handoff-packet.mjs`
- `src/batch/journal.mjs`
- `src/doctor/quota-risk.mjs`
- `tests/batch/diagnosis-quota-fallback.test.mjs`
- `tests/doctor/quota-risk.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/diagnosis-quota-fallback.test.mjs tests/doctor/quota-risk.test.mjs tests/batch/diagnosis.test.mjs tests/batch/journal.test.mjs tests/batch/diagnosis-salvage-pending-lane.test.mjs tests/compat/final-verdict-reconcile.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis-handoff-packet.mjs`, `src/doctor/quota-risk.mjs`, `tests/batch/diagnosis-quota-fallback.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `buildReconcileDiagnosisContext`, `buildBackground`, `extractJournalDiagnosisHints`, `collectQuotaPinTargets` — record in Discoveries
- [ ] `rg -n "worker died" src tests` — note tests asserting current text
- [ ] Dependencies satisfied

### Step 1: Diagnose context + text

- [ ] Context exposes `quotaFallback` / `lastQuotaExhausted`
- [ ] Background lines (incl. manifest line) and assessments
- [ ] Journal hint priority + summaries

**Artifacts:**
- `src/batch/reconcile-diagnosis-context.mjs`, `src/batch/diagnosis-handoff-packet.mjs`, `src/batch/journal.mjs` (modified)

### Step 2: Doctor

- [ ] Fallback worker in quota targets
- [ ] Same-pool advisory

**Artifacts:**
- `src/doctor/quota-risk.mjs` (modified)

### Step 3: Tests

- [ ] Diagnose cases incl. unchanged output without fallback data
- [ ] Doctor cases

**Artifacts:**
- `tests/batch/diagnosis-quota-fallback.test.mjs` (new), `tests/doctor/quota-risk.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch + doctor suites: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 SPINE_SUPPRESS_JOURNAL_ATTACH=1 node --experimental-strip-types --test tests/batch/*.test.mjs tests/doctor/*.test.mjs`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-811)

**Check If Affected:**
- None

## Completion Criteria

- [ ] Diagnose shows exhausted pool, reset time and active fallback, plus the paste-ready manifest line
- [ ] No-fallback quota failure shows the reset time instead of implying an immediate retry
- [ ] Doctor includes the fallback worker and warns on a same-pool fallback
- [ ] Output unchanged when no quota data exists

## Git Commit Convention

- `feat(SP-810): diagnose + doctor quota fallback surface (#329)`

## Do NOT

- Edit `src/batch/reconcile-batch.mjs` (at the line cap) or change diagnosis codes / precedence
- Change `suggestedCommand` logic
- Make the doctor advisory fail preflight
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
