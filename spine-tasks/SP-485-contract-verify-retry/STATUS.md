# SP-485: Contract verify retry — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Required files and paths exist
- [x] Dependencies satisfied

---

### Step 1: Add testCommand retry logic
**Status:** ✅ Complete

- [x] Retry logic wrapping testCommand execution
- [x] Configurable retry count from spine-config
- [x] Delay between retry attempts
- [x] Journal contract.test_retry events
- [x] Targeted tests pass

---

### Step 2: Capture failed testCommand output
**Status:** ✅ Complete

- [x] Write stdout+stderr to .reviews/ on failure
- [x] Include command, exit code, attempt in log header
- [x] No interference with retry flow
- [x] Targeted tests pass

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77% line coverage on in-scope code)
- [ ] Fail-then-succeed retry test
- [ ] All-retries-fail test
- [ ] Configurable retry count test
- [ ] Output capture test
- [ ] No-retry-on-success test
- [ ] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] contract.testRetries config documented
- [ ] Operator runbook updated
- [ ] Discoveries logged

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| PROMPT File Scope lists `merge.mjs` but `verifyContract` is called from `review.mjs` (line 698). `merge.mjs` only imports `matchesContractPattern`. | Log — retry logic placed in `contract-verify.mjs`; `review.mjs` wiring change is logically required | `src/batch/engine-lanes/review.mjs:698` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-03 | Task staged | PROMPT.md and STATUS.md created |
| 2026-07-03 | Step 0 complete | Preflight verified; contract-verify.mjs exists, no retry mechanism present |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
