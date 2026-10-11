# Task: SP-820 — Classify reviewer provider request errors as `review_provider_error`

**Created:** 2026-10-10
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Changes the exit reason recorded for some failed reviews. A too-broad matcher would relabel ordinary spawn failures; a too-narrow one leaves #334 unclassified.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** When the reviewer's model provider rejects a request (HTTP 400 `INVALID_ARGUMENT`, "Function call is missing a thought_signature", `MALFORMED_FUNCTION_CALL`), the reviewer exits non-zero or exits 0 without an artifact. `runStepReview` (`src/batch/review-step-run.mjs` ~293-400) returns `spawnFailed: true` with only `error`, `exitCode`, `durationMs`, `outputTail`, and `reviewerOutputLogRef`. `runReviewPhaseLoop` (`src/batch/engine-lanes/review-poll.mjs` ~328-350) then maps every non-timeout spawn failure to `${reviewType}_review_spawn_failed`, the same exit reason used for an empty model turn (#332) or a missing `pi` binary. Spawn results carry redacted `stdoutTail` / `stderrTail` (`src/batch/review-spawn.mjs` 268-288). `src/batch/provider-quota.mjs` already parses HTTP status payloads from pi output (`collectStatusPayloads`, line 93, not exported) for quota errors (429 and provider quota codes); quota errors must keep their existing handling. Line caps: `review-poll.mjs` is 496 lines and `review-step-run.mjs` is 473 (the phase23 structure check failed at 541 in v2.27.0), so new logic goes in a new module.

## Mission

Partial #334 — A reviewer failure caused by a provider request error is recorded as a distinct reason, with the provider message in the journal.

1. **Classifier** — new `src/batch/reviewer-provider-error.mjs`:
   - `export const REVIEW_PROVIDER_ERROR_REASON = "review_provider_error"`.
   - `export function classifyReviewerProviderError(output)` → `{ httpStatus: number|null, providerMessage: string } | null`. Match when the output has an HTTP 4xx status **other than 408 and 429**, or any of the markers `INVALID_ARGUMENT`, `thought_signature`, `MALFORMED_FUNCTION_CALL`. Return `null` when `classifyProviderQuotaError(output)` matches (quota keeps its own path), and for empty or non-string input. `providerMessage` is the provider's message text, trimmed and capped at 500 characters. You may export `collectStatusPayloads` from `provider-quota.mjs` to reuse it; do not change its behavior.
2. **Wire into the review result** (`src/batch/review-step-run.mjs`): in the final spawn-failed branch and in the no-artifact branch (after the SP-814 re-spawn loop, not inside it), run the classifier on `spawnResult.error`, `stderrTail`, and `stdoutTail`. When it matches, add `reason: REVIEW_PROVIDER_ERROR_REASON` and `providerMessage` (plus `httpStatus` when known) to **both** the `review.failed` journal payload and the returned result. Leave the nested-spawn, timeout, honor, and retry-eligibility paths unchanged. Keep the file ≤ 500 lines.
3. **Exit reason** (`src/batch/engine-lanes/review-poll.mjs`): when `reviewResult.reason === REVIEW_PROVIDER_ERROR_REASON`, the task exit reason is `${reviewType}_review_provider_error` (`plan_`, `code_`, `final_`). Timeout and the generic `_review_spawn_failed` mapping are unchanged. Keep the file ≤ 500 lines.
4. **Tests** — new `tests/batch/reviewer-provider-error.test.mjs`:
   - Gemini 400 `thought_signature` payload (stderr text from #334) → match, message contains `thought_signature`.
   - `MALFORMED_FUNCTION_CALL` on stdout with exit 0 → match.
   - 429 / z.ai `1308` quota payload → `null`.
   - Empty output, `pi not available for reviewer spawn`, and `reviewer spawn timed out` → `null`.
   - `runStepReview` with a stub reviewer that writes the Gemini 400 to stderr and exits 1 (follow the stub pattern in `tests/batch/review-no-artifact-respawn.test.mjs`) → result `reason: "review_provider_error"`, and the journaled `review.failed` keeps `providerMessage`.
   - Exit-reason mapping: a provider-error review result yields `code_review_provider_error`; a generic spawn failure still yields `code_review_spawn_failed`.

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh default`, which reviews this task's diff with stet (`.review/config.toml`: `qwen/qwen3.8-27b` on LM Studio with the OpenJev critic). When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>` (`false_positive`, `already_correct`, `wrong_suggestion`, `out_of_scope`), citing lint/typecheck/test evidence. Record stet reviewer bugs (invented syntax errors, stale hunks, parse failures) under Discoveries in STATUS.md. Never dismiss a real defect without fixing it. If stet itself fails (`stet doctor`), record a blocker; do not edit `.review/`.

## Dependencies

- **Task:** SP-828 (stet contract script and review config used by this Contract)

## Context to Read First

- GitHub #334 ("Where spine is fragile" item 3, "Proposed solution" item 3, acceptance criterion 3)
- `src/batch/review-step-run.mjs` 240-400; `src/batch/review-spawn-retry.mjs`
- `src/batch/engine-lanes/review-poll.mjs` 270-360
- `src/batch/provider-quota.mjs` 50-220; `tests/batch/provider-quota.test.mjs`
- `tests/batch/review-no-artifact-respawn.test.mjs` (stub reviewer pattern)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) and OpenJev System One at `http://127.0.0.1:8080`, for the stet step of the Contract only (unit tests need neither)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/reviewer-provider-error.mjs`
- `src/batch/review-step-run.mjs`
- `src/batch/engine-lanes/review-poll.mjs`
- `src/batch/provider-quota.mjs`
- `tests/batch/reviewer-provider-error.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/reviewer-provider-error.test.mjs tests/batch/review-no-artifact-respawn.test.mjs tests/batch/provider-quota.test.mjs tests/batch/*review-spawn*.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh default` |
| fileScopeMustChange | `src/batch/reviewer-provider-error.mjs`, `src/batch/review-step-run.mjs`, `src/batch/engine-lanes/review-poll.mjs`, `tests/batch/reviewer-provider-error.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `runStepReview` and `runReviewPhaseLoop` — record callers in Discoveries
- [ ] `rg -n '_review_spawn_failed' src bin tests` — list consumers; record which ones also need `_review_provider_error` (diagnosis consumers are SP-821's scope; note them, do not edit)
- [ ] Record current line counts of `review-step-run.mjs` and `review-poll.mjs`
- [ ] Dependencies satisfied

### Step 1: Classifier

- [ ] `classifyReviewerProviderError` + reason constant

**Artifacts:**
- `src/batch/reviewer-provider-error.mjs` (new)
- `src/batch/provider-quota.mjs` (modified — export only, if reused)

### Step 2: Wire result and exit reason

- [ ] Spawn-failed and no-artifact branches add `reason` + `providerMessage`
- [ ] `${reviewType}_review_provider_error` exit reason

**Artifacts:**
- `src/batch/review-step-run.mjs` (modified)
- `src/batch/engine-lanes/review-poll.mjs` (modified)

### Step 3: Tests

- [ ] Cases above

**Artifacts:**
- `tests/batch/reviewer-provider-error.test.mjs` (new)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review; triage per Mission)
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-825 documents the new exit reasons)

**Check If Affected:**
- None

## Completion Criteria

- [ ] A stub reviewer emitting a Gemini 400 `thought_signature` payload is classified as a provider error, not a generic spawn failure
- [ ] The journal keeps the provider message
- [ ] Quota, timeout, and missing-`pi` failures keep their current classification

## Git Commit Convention

- `fix(SP-820): classify reviewer provider request errors (#334)`

## Do NOT

- Change SP-814 re-spawn eligibility (`isReviewSpawnRetryEligible`) or the honor paths
- Change quota classification in `provider-quota.mjs` beyond adding an export
- Edit diagnosis files (`src/batch/diagnosis*.mjs`, `src/batch/reconcile-diagnosis*.mjs`) — SP-821 owns them
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- **2026-10-11 (operator, SP-828 stet adoption):** Contract `testCommand` ends with `bash scripts/spine-stet-contract-run.sh default`; added `fileScopeMustNotChange` `.review/**`, the LM Studio and OpenJev services, the stet triage paragraph in Mission, and the dependency on SP-828. To stay under the 500-character `testCommand` limit, `post-done-plan-review-spawn`, `salvage-final-review-spawn-failed`, and `review-spawn-timeout-recovery` are now matched by `tests/batch/*review-spawn*.test.mjs` (which also runs `review-spawn.test.mjs`).
