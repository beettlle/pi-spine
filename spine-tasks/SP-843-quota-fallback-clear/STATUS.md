# SP-843: Quota fallback hop can expire or be cleared — Status

**Current Step:** Not Started
**Status:** 🔵 Not Started
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `loadQuotaFallbackForWorker`, `decideQuotaFallback`, `buildQuotaFallbackState`, `applyQuotaFallback`
- [ ] Record every reader of `resilience.quotaFallback` (`rg -n 'quotaFallback' src`)

### Step 1: Reset parsing + expiry
**Status:** ⬜ Not Started

- [ ] `parseQuotaResetAt`; `resetAt` on the hop
- [ ] Expiry clears the hop once with a journal event; Row 5 respects cleared hops

### Step 2: Operator clear + diagnose
**Status:** ⬜ Not Started

- [ ] `spine batch quota-fallback clear` with state guards
- [ ] Diagnose shows expiry and the clear command

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Batch with an active hop whose primary has reset (injected `now`): retried worker spawns on the primary profile
- [ ] Operator clear journals `batch.quota_fallback_cleared` and refuses while running / with no hop
- [ ] Unparsable reset → no expiry
- [ ] A new quota error after clear can hop again

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook quota fallback section: expiry and `spine batch quota-fallback clear`
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-843-quota-fallback-clear/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
