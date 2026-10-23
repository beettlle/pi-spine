# Task: SP-845 — Separate contract review step with its own timeout and policy

**Created:** 2026-10-22
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Contract verification gates every lane. A wrong advisory/blocking default either lets defects through or keeps blocking on local-LLM review noise; a shared timeout keeps letting slow stet hunks kill fast test runs.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 1
**Problem theory:** Packets chain the stet review onto `testCommand` (`… && bash scripts/spine-stet-contract-run.sh lenient SP-###`), so review time counts against the test timeout. In v2.28, SP-843's lint, typecheck and tests took ~40 s, and stet (LM Studio under memory pressure) took the rest of the 10-minute cap twice. Review findings and test failures are also indistinguishable in `contract.failed`. `verifyContract` (`src/batch/contract-exec.mjs` ~310-400) runs `testCommand` with retries via `runContractTestCommand` (~145-200) and pushes `{ field: "testCommand", ok, detail }` checks. `contract.testTimeoutMs` (#369, `src/config/contract.mjs`) bounds the test run only. The PROMPT Contract table is parsed in `src/tasks/packet/parse-prompt.mjs` (field list ~25, `testCommand` case ~472, shell-metacharacter guard ~119-145) and validated in `src/tasks/packet/validate-contract.mjs`.

## Mission

Contract review runs as its own step with its own timeout and an explicit policy:

1. **`reviewCommand` Contract field** — Parsed like `testCommand` (single line, same shell-metacharacter guard, `&&` chains allowed). Runs once, after `testCommand` passes; skipped when the test step fails. No retries.
2. **Config** — `contract.reviewTimeoutMs` (integer, same bounds as `contract.testTimeoutMs`, default 20 min) and `contract.reviewPolicy` (`blocking` | `advisory`, default `blocking`). Validate in `src/config/contract.mjs`; add both to `spine settings` fields.
3. **`src/batch/contract-review.mjs` (new)** — Runs the command with the review timeout and returns a `reviewCommand` check:
   - `blocking`: a non-zero exit or a timeout fails the contract, with detail `reviewCommand failed: …` or `reviewCommand timed out after …`.
   - `advisory`: the check passes. The engine journals `contract.review_advisory` `{ taskId, exitCode, timedOut, summary }` and appends a line to the task STATUS.md Discoveries table.
4. **Wire-up** — `verifyContract` calls the review step. Register `contract.review_advisory` in `src/batch/journal.mjs`. Timeout diagnosis (`isContractTimeoutFailure`, `src/batch/diagnosis-primary-failure.mjs`) distinguishes a review timeout (suggests `contract.reviewTimeoutMs`) from a test timeout.
5. **Authoring + docs** — The `spine-task-authoring.mdc` Contract example moves the stet call to `reviewCommand`. Runbook §8.1 documents the two timeouts and the policy.

## Dependencies

- **None**

## Context to Read First

- `src/batch/contract-exec.mjs` 140-200, 300-420
- `src/config/contract.mjs` (whole file), `src/config/settings-fields.mjs` (contract fields)
- `src/tasks/packet/parse-prompt.mjs` 20-50, 115-150, 460-500
- `src/tasks/packet/validate-contract.mjs` 90-120, 210-225
- `src/batch/diagnosis-primary-failure.mjs` (`isContractTimeoutFailure`)
- `scripts/spine-stet-contract-run.sh`
- `tests/batch/contract-timeout-config.test.mjs`, `tests/batch/contract-verify-async.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` for the stet step of the Contract only
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/contract-exec.mjs` — 498 lines; stays ≤ 500: review logic lives in the new `contract-review.mjs`, and `verifyContract` gains only the call and check push (net ≤ +2 lines; offset by trimming elsewhere in the file if needed)
- `src/batch/contract-review.mjs` (new)
- `src/config/contract.mjs`
- `src/config/settings-fields.mjs`
- `src/tasks/packet/parse-prompt.mjs` — 784 lines (outside the `src/batch` cap); the new field adds ≤ 12 lines through the existing field list and switch
- `src/tasks/packet/validate-contract.mjs`
- `src/batch/journal.mjs`
- `src/batch/diagnosis-primary-failure.mjs`
- `tests/batch/contract-review.test.mjs` (new)
- `tests/config/settings-fields.test.mjs`
- `tests/tasks/contract-parse.test.mjs`
- `.cursor/rules/spine-task-authoring.mdc`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/contract-review.test.mjs tests/batch/contract-timeout-config.test.mjs tests/config/settings-fields.test.mjs tests/tasks/contract-parse.test.mjs tests/batch/contract-exec.test.mjs tests/batch/contract-verify.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-845` |
| fileScopeMustChange | `src/batch/contract-review.mjs`, `src/config/contract.mjs`, `src/tasks/packet/parse-prompt.mjs`, `tests/batch/contract-review.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `verifyContract`, `runContractTestCommand`, `parseContract`, `validateContractConfig`
- [ ] Confirm every test file in the Contract exists; changes go through Amendments

### Step 1: Parse + config

- [ ] `reviewCommand` parsed and validated like `testCommand`
- [ ] `contract.reviewTimeoutMs` / `contract.reviewPolicy` validated; settings fields added

**Artifacts:**
- `src/tasks/packet/parse-prompt.mjs`, `src/tasks/packet/validate-contract.mjs` (modified)
- `src/config/contract.mjs`, `src/config/settings-fields.mjs` (modified)

### Step 2: Review step

- [ ] `contract-review.mjs`: blocking and advisory outcomes, timeout label
- [ ] `verifyContract` runs it after a passing `testCommand`; `contract.review_advisory` journal event + STATUS Discoveries line
- [ ] Review-timeout diagnosis suggests `spine settings set contract.reviewTimeoutMs …`

**Artifacts:**
- `src/batch/contract-review.mjs` (new)
- `src/batch/contract-exec.mjs`, `src/batch/journal.mjs`, `src/batch/diagnosis-primary-failure.mjs` (modified)

### Step 3: Tests

- [ ] Blocking: failing review fails the contract with a `reviewCommand` check; test failure skips review
- [ ] Advisory: failing review passes, journals `contract.review_advisory`, writes STATUS line
- [ ] Review timeout honors `contract.reviewTimeoutMs` independently of `contract.testTimeoutMs`
- [ ] Parser rejects metacharacters and newlines in `reviewCommand`

**Artifacts:**
- `tests/batch/contract-review.test.mjs` (new)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Authoring rule Contract example uses `reviewCommand` for stet
- [ ] Runbook §8.1: test vs review timeouts; blocking vs advisory
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-845-contract-review-step/.DONE`

**Stet review (Contract):** this packet still chains stet onto `testCommand` because `reviewCommand` does not exist until it lands. When stet reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — contract review step
- `.cursor/rules/spine-task-authoring.mdc` — Contract example

**Check If Affected:**
- `skills/spine-release-operator/SKILL.md`
- `templates/` packet templates that show a Contract table

## Completion Criteria

- [ ] `reviewCommand` runs separately with its own timeout; blocking and advisory policies both tested
- [ ] `src/batch/contract-exec.mjs` ≤ 500 lines

## Git Commit Convention

- `feat(SP-845): separate contract review step with timeout and policy`

## Do NOT

- Retry `reviewCommand` (stet resumes its own session; retries re-review)
- Change `testCommand` semantics or `contract.testTimeoutMs`
- Default `contract.reviewPolicy` to `advisory`
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
