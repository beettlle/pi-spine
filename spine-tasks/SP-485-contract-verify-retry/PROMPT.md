# Task: SP-485 — Transient contract_failed: add retry and capture output

**Created:** 2026-07-03
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Modifies contract verification flow and merge gate; incorrect retry logic could mask real failures or cause double-commits. Touches engine lane lifecycle.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Canonical Task Folder

```
spine-tasks/SP-485-contract-verify-retry/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Tasks fail `contract_failed` during batch gate verification due to resource contention (multiple lanes running full test suites concurrently) or pre-existing test flakes, then pass on immediate re-run. This wastes batch cycles (15-20 min per retry) and requires manual merge workarounds.

Add two improvements:
1. **Configurable retry for `testCommand`:** When contract verification's `testCommand` fails, retry once (configurable via `contract.testRetries` in spine-config, default 1) with a short delay between attempts.
2. **Capture and log output:** Save stderr/stdout from failed contract runs to a file under the task's `.reviews/` directory for post-mortem diagnosis.

**Closes:** [#136](https://github.com/beettlle/pi-spine/issues/136)

## Dependencies

- **None**

## Context to Read First

**Tier 3 (load only if needed):**
- `src/batch/contract-verify.mjs` — contract verification implementation
- `src/batch/engine-lanes/merge.mjs` — where contract verify is called in the lane flow

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `src/batch/engine-lanes/merge.mjs`
- `tests/batch/contract-retry.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run coverage:check` |
| fileScopeMustChange | `src/batch/contract-verify.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/contract-retry.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] `src/batch/contract-verify.mjs` exists
- [ ] Understand how `testCommand` is executed and how failures are reported
- [ ] Check if any retry mechanism already exists

### Step 1: Add testCommand retry logic

- [ ] In `contract-verify.mjs`, wrap `testCommand` execution with retry logic
- [ ] Read retry count from spine-config `contract.testRetries` (default: 1)
- [ ] Add a configurable delay between retry attempts (default: 5 seconds)
- [ ] On retry, log attempt number and that this is a retry (not first attempt)
- [ ] Journal event `contract.test_retry` with attempt number and prior exit code
- [ ] Run targeted tests: `npm test -- tests/batch/contract`

**Artifacts:**
- `src/batch/contract-verify.mjs` (modified)

### Step 2: Capture failed testCommand output

- [ ] On `testCommand` failure, write combined stdout+stderr to `{task-folder}/.reviews/contract-fail-{timestamp}.log`
- [ ] Include the command that was run, exit code, and attempt number in the log header
- [ ] Ensure output capture doesn't interfere with the retry flow
- [ ] Run targeted tests: `npm test -- tests/batch/contract`

**Artifacts:**
- `src/batch/contract-verify.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Add test: testCommand fails once then succeeds on retry → contract passes
- [ ] Add test: testCommand fails all retries → contract_failed as before
- [ ] Add test: retry count configurable via spine-config
- [ ] Add test: failed output captured to .reviews/ directory
- [ ] Add test: no retry when testCommand succeeds first time (no performance cost)
- [ ] Fix all failures

**Artifacts:**
- `tests/batch/contract-retry.test.mjs` (new)

### Step 4: Documentation & Delivery

- [ ] Document `contract.testRetries` config option
- [ ] Update operator runbook with contract retry behavior
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — add contract retry and output capture info

**Check If Affected:**
- `docs/PRD.md` — contract verification section

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Transient testCommand failures are retried before marking contract_failed
- [ ] Failed output captured for diagnosis
- [ ] Documentation updated

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-485): complete Step N — description`
- **Bug fixes:** `fix(SP-485): description`
- **Tests:** `test(SP-485): description`
- **Hydration:** `hydrate: SP-485 expand Step N checkboxes`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Retry indefinitely — cap at configured max retries

---

## Amendments (Added During Execution)
