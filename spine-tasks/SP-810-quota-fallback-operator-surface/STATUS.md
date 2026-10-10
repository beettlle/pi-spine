# SP-810: Operator surface: diagnose + doctor quota fallback — Status

**Current Step:** Step 1: Diagnose context + text
**Status:** 🔄 In Progress
**Last Updated:** 2026-10-10
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Text-asserting tests noted
- [x] Dependencies satisfied

### Step 1: Diagnose context + text
**Status:** 🔄 In Progress

- [ ] Context fields
- [ ] Background + assessment
- [ ] Journal hints

### Step 2: Doctor
**Status:** ⬜ Not Started

- [ ] Fallback target
- [ ] Same-pool advisory

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Diagnose cases
- [ ] Doctor cases

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch + doctor suites
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Impact: `buildReconcileDiagnosisContext` CRITICAL (27 symbols: reconcile/handoff/dashboard/issue-draft share it); `buildBackground` CRITICAL (20 via `buildDiagnosisOutput`); `extractJournalDiagnosisHints` + `collectQuotaPinTargets` LOW (no upstream). Mitigation: all changes additive — new ctx fields and new output lines only exist when quota data exists. |
| 2 | `rg "worker died"`: only `tests/batch/post-done-plan-review-spawn.test.mjs:166` asserts a headline does NOT match /worker died\|retry or abort/ (headline untouched). `tests/cli/spine-handoff.test.mjs:192` hardcodes the needs_retry assessment string as fixture *input*, not derived output. No test asserts the provider-exit assessment text. |
| 3 | Dependencies OK: SP-805 `agents.quotaFallbackProfile` present (`settings-fields.mjs:155`, schema `:300`); SP-808 state shape + journal payloads present (`engine-lanes/quota-fallback-state.mjs`, `worker-host.mjs:74` journals `worker.quota_exhausted`). SP-809 engine wiring is NOT in this tree — diagnose only needs the persisted state + journal payloads, which SP-808 defines. |
| 4 | `batch.quota_fallback_exhausted` payload carries `exhaustedPools[]` + index-aligned `resetAtRaw[]`; `worker.quota_exhausted` carries single `poolId`/`resetAtRaw`. Distinguisher for assessment logic: `Array.isArray(payload.exhaustedPools)`. |
| 5 | Journal events reach the context via `signals.journalEvents` (reconcile-batch.mjs:198) — reused for `lastQuotaExhausted`, no second journal read. |

## Blockers

_None._
