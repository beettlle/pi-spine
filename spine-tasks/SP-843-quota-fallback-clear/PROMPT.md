# Task: SP-843 — Quota fallback hop can expire or be cleared

**Created:** 2026-10-17
**Size:** M

## Review Level: 1 (Plan Only)

**Risk:** Clearing the hop too early sends workers back to an exhausted pool; never clearing it strands batches on a second exhausted pool (#350).
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** `applyQuotaFallback` (`src/batch/engine-lanes/quota-fallback-state.mjs:51`) stores `state.resilience.quotaFallback`; `loadQuotaFallbackForWorker` (170) returns it whenever `state.batchId` matches and never checks time; `decideQuotaFallback` Row 5 (`src/batch/quota-fallback.mjs` 228-240) makes any existing hop sticky. Nothing clears it: `retryTask` (`src/batch/retry.mjs`) never touches `quotaFallback`; `batch-meta-reconstruct.mjs:326` preserves it. `resetAtRaw` comes from `extractResetAtRaw` (`src/batch/provider-quota.mjs` 121-125, z.ai `reset at YYYY-MM-DD HH:MM:SS`, provider local time, assumed UTC+8); after SP-838 Google errors carry `retry in <N>s`. `spine status --diagnose` prints "Quota fallback active" (`src/batch/diagnosis-handoff-packet.mjs` 73-90, 150-158) but suggests no clear command. Clock injection pattern: `now` parameters in `runWithQuotaFallback` (`quota-fallback-run.mjs` 81) and `buildQuotaFallbackState` (`quota-fallback.mjs` 285).

## Mission

Closes #350 — A batch can return to its primary pool after it resets: by expiry when the reset time parses, or by an explicit operator command.

1. **Reset parsing** — `parseQuotaResetAt(resetAtRaw, { at })` in `src/batch/quota-fallback.mjs`: z.ai `YYYY-MM-DD HH:MM:SS` → epoch ms assuming UTC+8; `retry in <N>s` → `at + N*1000`; anything else → `null`. Store `resetAt` (ms or null) on the hop in `buildQuotaFallbackState`.
2. **Expiry** — `loadQuotaFallbackForWorker(state, { now = Date.now() })` returns `null` and marks the hop expired when `resetAt` is set and `now >= resetAt + 5 min grace`; the engine journals `batch.quota_fallback_cleared` `{ reason: "expired", fromProfile, toProfile, exhaustedPool, resetAt }` once and deletes `state.resilience.quotaFallback` (persist with `saveEngineBatchState`). `decideQuotaFallback` Row 5 no longer treats a cleared hop as sticky, so a later quota error can hop again.
3. **Operator clear** — `spine batch quota-fallback clear` in `bin/spine-batch.mjs`: requires a batch that is not `running` (paused / failed / needs_retry), deletes the hop, journals `batch.quota_fallback_cleared` `{ reason: "operator" }`, prints the next command (`spine batch retry <taskId>` / `spine batch resume`). Errors with a clear message when no hop is active.
4. **Diagnose** — when a hop is active, `diagnosis-handoff-packet.mjs` prints the expiry (`expires <iso>` or `no parsable reset time`) and, when the fallback pool is also exhausted, suggests `spine batch quota-fallback clear`.
5. Register `batch.quota_fallback_cleared` in `src/batch/journal.mjs`; document both paths in the operator runbook quota fallback section.

## Dependencies

- **Requires:** SP-836 (`bin/spine-batch.mjs` edits — same file, serialize)
- **Requires:** SP-838 (Google `retry in <N>s` reset string)

## Context to Read First

- GitHub #350
- `src/batch/quota-fallback.mjs` (whole file)
- `src/batch/engine-lanes/quota-fallback-state.mjs` (whole file)
- `src/batch/engine-lanes/quota-fallback-run.mjs` 75-155
- `src/batch/diagnosis-handoff-packet.mjs` 60-160
- `bin/spine-batch.mjs` 140-240
- `tests/batch/quota-fallback.test.mjs`, `tests/batch/quota-fallback-state.test.mjs`, `tests/batch/quota-fallback-integration.test.mjs`, `tests/batch/diagnosis-quota-fallback.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/quota-fallback.mjs`
- `src/batch/engine-lanes/quota-fallback-state.mjs`
- `src/batch/diagnosis-handoff-packet.mjs`
- `src/batch/journal.mjs`
- `bin/spine-batch.mjs`
- `tests/batch/quota-fallback.test.mjs`
- `tests/batch/quota-fallback-state.test.mjs`
- `tests/batch/quota-fallback-clear.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/quota-fallback.test.mjs tests/batch/quota-fallback-state.test.mjs tests/batch/quota-fallback-clear.test.mjs tests/batch/quota-fallback-integration.test.mjs tests/batch/diagnosis-quota-fallback.test.mjs tests/batch/batch-meta-reconstruct.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-843` |
| fileScopeMustChange | `src/batch/quota-fallback.mjs`, `src/batch/engine-lanes/quota-fallback-state.mjs`, `bin/spine-batch.mjs`, `tests/batch/quota-fallback-clear.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `loadQuotaFallbackForWorker`, `decideQuotaFallback`, `buildQuotaFallbackState`, `applyQuotaFallback`
- [ ] Record every reader of `resilience.quotaFallback` (`rg -n 'quotaFallback' src`)

### Step 1: Reset parsing + expiry

- [ ] `parseQuotaResetAt`; `resetAt` on the hop
- [ ] Expiry clears the hop once with a journal event; Row 5 respects cleared hops

**Artifacts:**
- `src/batch/quota-fallback.mjs` (modified)
- `src/batch/engine-lanes/quota-fallback-state.mjs` (modified)
- `src/batch/journal.mjs` (modified)

### Step 2: Operator clear + diagnose

- [ ] `spine batch quota-fallback clear` with state guards
- [ ] Diagnose shows expiry and the clear command

**Artifacts:**
- `bin/spine-batch.mjs` (modified)
- `src/batch/diagnosis-handoff-packet.mjs` (modified)

### Step 3: Tests

- [ ] Batch with an active hop whose primary has reset (injected `now`): retried worker spawns on the primary profile
- [ ] Operator clear journals `batch.quota_fallback_cleared` and refuses while running / with no hop
- [ ] Unparsable reset → no expiry
- [ ] A new quota error after clear can hop again

**Artifacts:**
- `tests/batch/quota-fallback-clear.test.mjs` (new)
- `tests/batch/quota-fallback.test.mjs` (modified)
- `tests/batch/quota-fallback-state.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Runbook quota fallback section: expiry and `spine batch quota-fallback clear`
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-843-quota-fallback-clear/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-843`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — quota fallback expiry and clear

**Check If Affected:**
- `skills/spine-release-operator/SKILL.md`

## Completion Criteria

- [ ] Hop expires after a parsable reset or is cleared by the operator; both journaled
- [ ] Diagnose names the sticky hop and the clear command

## Git Commit Convention

- `fix(SP-843): expire or clear the quota fallback hop (#350)`

## Do NOT

- Make quota fallback multi-hop
- Clear the hop on plain `spine batch retry` (operator intent must be explicit)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
