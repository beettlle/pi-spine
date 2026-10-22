# SP-843: Quota fallback hop can expire or be cleared — Status

**Current Step:** Step 4: Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `loadQuotaFallbackForWorker`, `decideQuotaFallback`, `buildQuotaFallbackState`, `applyQuotaFallback`
- [x] Record every reader of `resilience.quotaFallback` (`rg -n 'quotaFallback' src`)

### Step 1: Reset parsing + expiry
**Status:** ✅ Complete

- [x] `parseQuotaResetAt`; `resetAt` on the hop
- [x] Expiry clears the hop once with a journal event; Row 5 respects cleared hops

### Step 2: Operator clear + diagnose
**Status:** ✅ Complete

- [x] `spine batch quota-fallback clear` with state guards
- [x] Diagnose shows expiry and the clear command

### Step 3: Tests
**Status:** ✅ Complete

- [x] Batch with an active hop whose primary has reset (injected `now`): retried worker spawns on the primary profile
- [x] Operator clear journals `batch.quota_fallback_cleared` and refuses while running / with no hop
- [x] Unparsable reset → no expiry
- [x] A new quota error after clear can hop again

### Step 4: Testing & Verification
**Status:** 🟡 In Progress

- [x] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** 🟡 In Progress

- [x] Runbook quota fallback section: expiry and `spine batch quota-fallback clear`
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-843-quota-fallback-clear/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Readers of `resilience.quotaFallback` (Step 0): `quota-fallback-run.mjs` (decide/pin), `task-agent-profile.mjs` (profile resolution, reads state then `loadQuotaFallbackForWorker`), `worker-host.mjs` via `resolveWorkerQuotaFallbackContext`, `reconcile-diagnosis-context.mjs` → diagnose, `batch-meta-reconstruct.mjs:326` (preserve) | Recorded; expiry covered by clearing in-memory state + expiry-aware loader | `src/batch/**` |
| GitNexus impact for `loadQuotaFallbackForWorker`, `decideQuotaFallback`, `buildQuotaFallbackState`, `applyQuotaFallback`: all LOW (`decideQuotaFallback` → `runWithQuotaFallback` only) | No action | — |
| Engine wiring needs `src/batch/engine-lanes/quota-fallback-run.mjs` (not in the PROMPT File Scope; scope is stall-detection only, not enforced) | Edited: clear expired hop before the run and before each decision; pass `now` to `decideQuotaFallback` | `src/batch/engine-lanes/quota-fallback-run.mjs` |
| Existing quota tests used a past z.ai reset (`2026-08-30`) with the real clock, so the new expiry fired | Fixtures moved to `2099-08-30` where the real clock is used; hop-shape expectations gained `resetAt` | `tests/batch/quota-fallback-state.test.mjs`, `tests/batch/quota-fallback-integration.test.mjs`, `tests/batch/quota-fallback.test.mjs` |
| `loadQuotaFallbackForWorker` stays read-only: it returns null for an expired hop; deletion and journaling live in `clearExpiredQuotaFallback` (engine) | Design choice | `src/batch/engine-lanes/quota-fallback-state.mjs` |
| Hops persisted before SP-843 have no `resetAt` and never expire (operator clear still works) | Accepted | — |
| `skills/spine-release-operator/SKILL.md` described the hop as single-hop/sticky; updated for expiry/clear | Done | `skills/spine-release-operator/SKILL.md` |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
| 2026-10-22 | Steps 0-3, 5 (docs) implemented; lint + typecheck green; targeted tests green | Contract testCommand run pending |
