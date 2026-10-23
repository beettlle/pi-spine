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
| Operator amendment `0762d637` dropped stet from SP-845's Contract `testCommand` (recurring hunk-only false positives); the PROMPT's prose "Stet review (Contract)" paragraph is stale but the Contract table is authoritative. This resume re-ran the amended command: lint, typecheck, 8 suites, exit 0; coverage gate 3193/3193 tests, 91.35% in-scope line coverage (threshold 77%); `contract-exec.mjs` 483 ≤ 500 | amendment accepted, re-verified green | Contract testCommand (amended) |
| Engine post-.DONE contract verify failed twice (06:05, 06:13) on 16 stet findings; a concurrent triage dismissed all 16 and this resume independently re-verified each against source before accepting: timeout-label regex preserves `0.5 min` (only trailing zeros strip), sole `isContractTimeoutFailure` caller uses `&&` assignment with an explicit `=== "review"` branch at diagnosis-primary-failure.mjs:94, `verifyContract` exports from both contract-verify.mjs:59 and contract-exec.mjs:288, EXPECTED_PATHS is alphabetized and includes both new paths, min bound 1000 makes the `1000` fixture valid, review wiring confirmed at contract-exec.mjs:370 | all 16 false_positive, verified with evidence | stet session SP-845 resume |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-22 | Task staged | PROMPT.md created |
| 2026-10-23 | Resume after engine contract-fail (stet 16 findings, dismissed by concurrent triage) | 16/16 re-verified false_positive; Contract re-run green (lint, typecheck, 8 suites, stet 0 findings, exit 0); .DONE recreated |
| 2026-10-23 | REVISE resume after amendment `0762d637` (stet dropped from Contract testCommand); engine removed .DONE pending re-verification | Amended Contract run green (lint, typecheck, 8 suites, exit 0); `npm run coverage:check` green (3193/3193, 91.35%); completion criteria re-checked; .DONE recreated |

## Blockers

*None*
