# Task: SP-869 — Validate --batch IDs at CLI entry points; sanitize review baseline

**Created:** 2026-11-18
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Unvalidated --batch can escape .spine/runtime; unvalidated review baseline enables git option injection and prompt injection.
**Score:** 6/8 — Blast radius: 3, Pattern novelty: 1, Security: 2, Reversibility: 0
**Problem theory:** `validateBatchId` exists (#258) but only journal-follow / some paths use it. Agent-supplied `baseline` is interpolated into `git diff ${baseline}..HEAD` and the reviewer prompt without allowlisting.

## Mission

Closes #313 — Close the two trust-boundary gaps:

1. **`--batch` IDs** — Call `validateBatchId` (or equivalent) at every CLI entry that joins a batch ID into runtime paths: at minimum `spine gate`, `spine integrate`, `spine batch` (`--batch`), `spine state`, `spine journal` replay/export, `spine handoff`, `spine metrics show`, and any other argv `--batch` readers found by `rg`. Invalid IDs → non-zero exit + clear error; never `path.join` raw input.
2. **Review `baseline`** — Before use in `git diff` / prompt text, allowlist to a safe git object name (full/short SHA or existing validated ref form). Reject values that look like options (`-*`, `--*`), contain whitespace/newlines, or path metacharacters. Fail the review step closed with a clear error — do not interpolate unsafe baselines into shell or prompts.
3. **Tests** — CLI rejection cases for malicious `--batch`; baseline rejection cases for `../`, `--output=`, newline injection.

## Dependencies

- **None**

## Context to Read First

- GitHub #313
- `src/batch/batch-id.mjs` (`validateBatchId`)
- `bin/spine-gate.mjs`, `bin/spine-integrate.mjs`, `bin/spine-batch.mjs`, `bin/spine-journal.mjs`, `bin/spine-state.mjs`
- `src/batch/review-step.mjs`, `src/batch/review-scope.mjs`
- Prior: #258 / SP-714

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/batch-id.mjs`
- `bin/spine-gate.mjs`
- `bin/spine-integrate.mjs`
- `bin/spine-batch.mjs`
- `bin/spine-journal.mjs`
- `bin/spine-state.mjs`
- `src/cli/handoff.mjs`
- `src/batch/review-step.mjs`
- `src/batch/review-scope.mjs`
- `tests/batch/batch-id-validation.test.mjs`
- `tests/batch/review-baseline-validate.test.mjs`
- `tests/cli/gate-batch-id.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/batch-id-validation.test.mjs tests/batch/review-baseline-validate.test.mjs tests/cli/gate-batch-id.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-869` |
| fileScopeMustChange | `src/batch/batch-id.mjs`, `src/batch/review-step.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] `rg -n "--batch|validateBatchId" bin/ src/cli/ src/batch/` — list entry points missing validation
- [ ] GitNexus impact on `validateBatchId` / review baseline; report in STATUS

### Step 1: Validate --batch + baseline

- [ ] Wire `validateBatchId` at all CLI `--batch` readers listed in Mission
- [ ] Add baseline allowlist helper; use in review-step / review-scope before git/prompt

### Step 2: Tests

- [ ] Malicious `--batch` rejected
- [ ] Malicious baseline rejected; safe SHA still works

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-869-batch-id-baseline-validate/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — only if CLI error messages need a one-line note (prefer Discoveries)

## Completion Criteria

- [ ] All `--batch` CLI entry points validate IDs
- [ ] Unsafe baselines rejected before git/prompt use
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-869): validate --batch IDs and review baselines (#313)`

## Do NOT

- Weaken BATCH_ID_PATTERN
- Pass baseline through a shell without validation
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
