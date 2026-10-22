# SP-836: `spine batch retry --profile` and `agents.escalatePolicy` escalation — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `retryTask`, `resetTaskForRetry`, `stripBatchFlagValueTokens`
- [x] Record the exact content-failure classification strings

### Step 1: `--profile` and auto escalation
**Status:** ✅ Complete

- [x] Flag parsing, validation, eligibility gate
- [x] `escalatePolicy` auto path and `--no-escalate`
- [x] `profileOverride` preserved; journal payload extended

### Step 2: Tests
**Status:** ✅ Complete

- [x] `--profile` on `contract_failed` sets override; on `provider_quota_exhausted` errors
- [x] Unknown profile errors
- [x] Auto escalation on `review_exhausted` when enabled; not when disabled; not on quota/launch classes; `--no-escalate`
- [x] `task.retry_requested` payload fields

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint`
- [x] Run Contract `testCommand` (ends with the stet review)
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Runbook retry/escalation section
- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-836-retry-profile-escalation/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Failure class is `task.exitReason` (`contract_failed`, `review_exhausted`; set in `review-final.mjs` / `review-poll.mjs`); no `*_review_exhausted` variants exist. `resetTaskForRetry` clears it and returns `status` as `previousClassification`, so the class is read before reset. | Eligible set = `contract_failed`, `review_exhausted` | `src/batch/retry.mjs` |
| `resetTaskForRetry` only touches known fields, so `profileOverride` is preserved without changing `state.mjs`. GitNexus impact on it is HIGH (retryTaskRow, runWithQuotaFallback) — not modified. | No change | `src/batch/state.mjs` |
| `--profile` on a matrix row retry (`SP-X[rowId]`) is rejected; escalation is whole-task only. | Added guard | `bin/spine-batch.mjs` |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
| 2026-10-17 | Implemented --profile / --no-escalate / escalatePolicy; tests + runbook | lint, typecheck, retry tests pass |
| 2026-10-17 | Contract testCommand: lint, typecheck, retry tests, stet lenient | pass; 4 stet findings dismissed (false_positive/already_correct, evidence in dismiss reasons) |
