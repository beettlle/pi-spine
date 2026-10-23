# SP-845: Separate contract review step with its own timeout and policy — Status

**Current Step:** Done
**Status:** ✅ Complete
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
**Status:** ✅ Complete

- [x] Authoring rule Contract example uses `reviewCommand` for stet
- [x] Runbook §8.1: test vs review timeouts; blocking vs advisory
- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-845-contract-review-step/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| GitNexus impact: `parseContract` (39 impacted) and `validateContractConfig` (83 impacted) rate CRITICAL; changes kept strictly additive (new optional field + optional config keys), covered by the parse/config suites in the Contract testCommand | accepted with mitigation | Step 0 preflight |
| `contract.review_advisory` "registration" = emission via `appendJournalEvent` from `journal.mjs`; no central event-type allowlist exists, so `journal.mjs` is unchanged (499 lines) | resolved by design | src/batch/contract-review.mjs |
| `buildContractTestEnv`/`CONTRACT_TEST_WORKER_ENV_KEYS` moved to `contract-spawn.mjs` (re-exported from `contract-exec.mjs`) so `contract-review.mjs` stays import-cycle-free per the arch guard | done | src/batch/contract-spawn.mjs |
| Stet review: 13 findings, all dismissed as false_positive with evidence (verifyContract IS exported from contract-verify.mjs:59; `contractTimedOut === "review"` IS handled in headline+command builders; reviewCommand IS implemented in parse-prompt; review-timeout suggestion 1200000 sits inside the fixed 1000–14400000 bounds). Cosmetic fix applied: EXPECTED_PATHS fixture re-alphabetized | triaged, 0 real defects | stet session SP-845 |
| Newlines cannot appear inside a Markdown table cell, so the parser's newline guard is only reachable via matrix-row substitution; the review runner re-checks it before spawn (defense in depth, SP-781 pattern) | documented | src/batch/contract-review.mjs |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-22 | Task staged | PROMPT.md created |

## Blockers

*None*
