# SP-845: Separate contract review step with its own timeout and policy — Status

**Current Step:** Step 5
**Status:** 🔵 In Progress
**Last Updated:** 2026-10-23
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `verifyContract`, `runContractTestCommand`, `parseContract`, `validateContractConfig`
- [x] Confirm every test file in the Contract exists; changes go through Amendments

### Step 1: Parse + config
**Status:** ✅ Complete

- [x] `reviewCommand` parsed and validated like `testCommand`
- [x] `contract.reviewTimeoutMs` / `contract.reviewPolicy` validated; settings fields added

### Step 2: Review step
**Status:** ✅ Complete

- [x] `contract-review.mjs`: blocking and advisory outcomes, timeout label
- [x] `verifyContract` runs it after a passing `testCommand`; `contract.review_advisory` journal event + STATUS Discoveries line
- [x] Review-timeout diagnosis suggests `spine settings set contract.reviewTimeoutMs …`

### Step 3: Tests
**Status:** ✅ Complete

- [x] Blocking: failing review fails the contract with a `reviewCommand` check; test failure skips review
- [x] Advisory: failing review passes, journals `contract.review_advisory`, writes STATUS line
- [x] Review timeout honors `contract.reviewTimeoutMs` independently of `contract.testTimeoutMs`
- [x] Parser rejects metacharacters and newlines in `reviewCommand`

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint`
- [x] Run Contract `testCommand` (ends with the stet review)
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Authoring rule Contract example uses `reviewCommand` for stet
- [ ] Runbook §8.1: test vs review timeouts; blocking vs advisory
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-845-contract-review-step/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-22 | Task staged | PROMPT.md created |

## Blockers

*None*
