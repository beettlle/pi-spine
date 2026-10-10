# SP-810: Operator surface: diagnose + doctor quota fallback — Status

**Current Step:** Step 4: Testing & Verification
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
**Status:** ✅ Complete

- [x] Context fields
- [x] Background + assessment
- [x] Journal hints

### Step 2: Doctor
**Status:** ✅ Complete

- [x] Fallback target
- [x] Same-pool advisory

### Step 3: Tests
**Status:** ✅ Complete

- [x] Diagnose cases
- [x] Doctor cases

### Step 4: Testing & Verification
**Status:** 🔄 In Progress

- [x] Lint (`npm run lint` clean)
- [x] Contract `testCommand` (90/90 pass)
- [x] Batch + doctor suites (1852/1852 pass)
- [ ] Coverage gate (blocked by pre-existing env flake — see Discovery 8; retrying)
- [x] Fix all failures (phase23 500-LOC cap breach in journal.mjs fixed by compaction; 497 lines)

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

| 6 | Doctor same-pool advisory compares the fallback profile worker pool against the *effective* active worker (active profile worker pin, else base `agents.worker.model`), mirroring engine model resolution. Exported as `detectSamePoolQuotaFallback` for direct testing; appended to `buildQuotaRiskDoctorCheck` risks so it stays `ok: true` (never fails preflight). || 7 | `src/batch/journal.mjs` sits near the 500-LOC batch-module cap (phase23-exit-verify); Step 1 additions breached it (505). Compacted the quota summary block to 497 counted lines. Any future journal.mjs growth must move code out, not in. |
| 8 | Coverage gate (`npm run coverage:check`) aborts on `tests/batch/sequence-detached-poll.test.mjs` "waitForSequenceBatchTerminal hard-caps at maxWaitMs" — a timing assert (elapsed <2s on a 300ms cap) that fails under machine load 35–50 (sibling lanes running). Reproduced on base commit 6368ffba in a temp worktree (identical failure), so it is pre-existing and unrelated to SP-810. Test passes standalone and in the full batch+doctor suite without coverage instrumentation. |
