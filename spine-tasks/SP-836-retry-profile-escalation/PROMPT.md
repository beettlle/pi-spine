# Task: SP-836 — `spine batch retry --profile` and `agents.escalatePolicy` escalation

**Created:** 2026-10-17
**Size:** M

## Review Level: 1 (Plan Only)

**Risk:** Escalation moves a retried task to a stronger (more expensive) model. Escalating on quota/403/launch-storm failures is explicitly banned (#248, #329) and must be impossible.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** `agents.escalatePolicy { enabled, toProfile }` is validated (`src/config/spine-config-schema.mjs` ~361-397) and read by `src/doctor/quota-risk.mjs` 62-72, but nothing in `src/batch` consumes it (`src/batch/quota-fallback.mjs:18` says it is deliberately not consulted). `spine batch retry` (`bin/spine-batch.mjs` ~350-379; flags parsed with `args.indexOf` ~150-170; value flags must be listed in `stripBatchFlagValueTokens`) calls `retryTask` (`src/batch/retry.mjs` 205-…) → `resetTaskForRetry` (`src/batch/state.mjs` 235-269), bumps `retryCountByScope`, and journals `task.retry_requested` `{ taskId, previousClassification, pendingSegments, retriedRowIds? }` (~289-299). SP-835 already reads `task.profileOverride` in `resolveTaskWorkerProfile`.

## Mission

Closes #340 — Operators can retry a task on another profile, and `escalatePolicy` applies automatically on retry, only for content/contract failure classes.

1. **Eligible classes** — export `ESCALATION_ELIGIBLE_CLASSES = ["contract_failed", "review_exhausted"]` from `src/batch/retry.mjs` (check `review-poll.mjs` ~402-426 and `review-final.mjs` ~138-159 for the exact classification strings and include any `*_review_exhausted` variant that is a content failure). Everything else — `provider_quota_exhausted`, `provider_overloaded`, `launch_failed`, stall/orphan classes, `review_blocked`, spawn/provider review failures — is ineligible.
2. **`--profile <name>`** on `spine batch retry <taskId>`:
   - parse it in `bin/spine-batch.mjs` and add it to `stripBatchFlagValueTokens`; update the usage string;
   - unknown profile → error exit with the list of defined profiles;
   - previous classification ineligible → error exit: `--profile is for content/contract failures; <class> is a provider/infra failure — use agents.quotaFallbackProfile or retry without --profile`;
   - eligible → set `task.profileOverride = <name>` in batch state before reset.
3. **Automatic escalation** — `spine batch retry <taskId>` without `--profile`, when `agents.escalatePolicy.enabled` is true, `toProfile` is set, and the previous classification is eligible → set `task.profileOverride = toProfile`. Do not escalate twice to the same profile (no-op when already set). `--no-escalate` skips it for one retry.
4. **State + journal** — `resetTaskForRetry` must preserve `profileOverride` (verify; adjust only if it clears unknown fields). `task.retry_requested` payload gains `profileOverride` and `escalation: "manual" | "auto" | null`.
5. **Docs** — operator runbook: retry `--profile`, escalation policy, eligible classes, and the explicit statement that quota/403 failures use quota fallback, never escalation.

## Dependencies

- **Requires:** SP-835 (`resolveTaskWorkerProfile` reads `task.profileOverride`)

## Context to Read First

- GitHub #340 (items 2-3), #248, #329
- `bin/spine-batch.mjs` 140-240, 345-385
- `src/batch/retry.mjs` 130-300; `src/batch/state.mjs` 230-270
- `src/batch/engine-lanes/review-poll.mjs` 395-430; `src/batch/engine-lanes/review-final.mjs` 130-160
- `src/batch/engine-lanes/task-agent-profile.mjs` (SP-834/835)
- `tests/batch/retry.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `bin/spine-batch.mjs`
- `src/batch/retry.mjs`
- `src/batch/state.mjs`
- `tests/batch/retry.test.mjs`
- `tests/batch/retry-escalation.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/retry.test.mjs tests/batch/retry-escalation.test.mjs tests/batch/retry-row.test.mjs tests/batch/batch-retry-failed-phase.test.mjs tests/batch/pause-retry-guard.test.mjs tests/batch/retry-state-drift.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-836` |
| fileScopeMustChange | `bin/spine-batch.mjs`, `src/batch/retry.mjs`, `tests/batch/retry-escalation.test.mjs`, `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `retryTask`, `resetTaskForRetry`, `stripBatchFlagValueTokens`
- [ ] Record the exact content-failure classification strings

### Step 1: `--profile` and auto escalation

- [ ] Flag parsing, validation, eligibility gate
- [ ] `escalatePolicy` auto path and `--no-escalate`
- [ ] `profileOverride` preserved; journal payload extended

**Artifacts:**
- `bin/spine-batch.mjs` (modified)
- `src/batch/retry.mjs` (modified)
- `src/batch/state.mjs` (modified only if needed)

### Step 2: Tests

- [ ] `--profile` on `contract_failed` sets override; on `provider_quota_exhausted` errors
- [ ] Unknown profile errors
- [ ] Auto escalation on `review_exhausted` when enabled; not when disabled; not on quota/launch classes; `--no-escalate`
- [ ] `task.retry_requested` payload fields

**Artifacts:**
- `tests/batch/retry-escalation.test.mjs` (new)
- `tests/batch/retry.test.mjs` (modified if shared fixtures change)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Runbook retry/escalation section
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-836-retry-profile-escalation/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-836`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — retry `--profile` and escalation policy

**Check If Affected:**
- `skills/spine-release-operator/SKILL.md`

## Completion Criteria

- [ ] Escalation and `--profile` apply only to content/contract failures
- [ ] Journal shows the override and whether it was manual or automatic

## Git Commit Convention

- `feat(SP-836): retry --profile and escalatePolicy escalation (#340)`

## Do NOT

- Auto-retry tasks (escalation applies when the operator runs retry)
- Escalate on quota, 403, overload, launch or stall failures
- Change quota fallback behavior (SP-843 owns #350)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
