# Task: SP-834 — Engine reviewer spawns use the effective reviewer profile

**Created:** 2026-10-17
**Size:** M

## Review Level: 1 (Plan Only)

**Risk:** Touches `src/batch/engine-lanes.mjs` (hot) and every engine plan/code/final review spawn. A wrong config passed to reviews changes which model judges every task. Review Level stays 1 because engine code review is broken until #343 lands (SP-840).
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** Engine reviews (`runPlanReviewPhase` / `runCodeReviewPhase` / `runFinalReviewPhase`, called at `src/batch/engine-lanes.mjs` ~391/408/425 and from `src/batch/resume-lane-reviews.mjs` 11-20) receive the batch-wide `config` loaded at engine start (`engine.mjs:100`). `buildReviewerPiArgs` (`src/batch/review-spawn.mjs` 120-152) resolves pins from `config.agents.reviewer` only. Quota fallback never reaches engine reviews (the hop lives only in the worker child env, `quota-fallback-state.mjs` 127-131). No review journal event records the reviewer model (`review.started` at `src/batch/review-step-run.mjs` ~130 has `{stepNumber, reviewType, reviewLevel, artifactPath}`).

## Mission

Closes #355 — Every engine review spawn uses the reviewer chosen by `resolveEffectiveReviewer` (SP-832) for that task, honoring PROMPT `**Reviewer Profile:**` (SP-833), the effective worker profile, `agents.reviewerProfile`, and the model-family guard. The worker is unaffected.

1. **Per-task agent context** — new `src/batch/engine-lanes/task-agent-profile.mjs`:
   - `resolveTaskWorkerProfile({ config, prompt, quotaFallback })` → `{ profile, model, thinking, source }`. Order: active quota fallback hop (`state.resilience.quotaFallback`, read via `loadQuotaFallbackForWorker`) when its `exhaustedPool` equals the pool of the task's own worker model (`resolvePoolId` from `src/metrics/quota-snapshot.mjs`), then `prompt.profile`, then `agents.activeProfile`. `model` / `thinking` come from `agents.profiles[profile].worker` falling back to `agents.worker`. (SP-835 adds `prompt.thinking` and `task.profileOverride`; keep the function easy to extend.)
   - `buildTaskReviewConfig({ config, prompt, workerContext })` → `{ config: reviewConfig, reviewer, blocked, warnings }` where `reviewConfig` is a `structuredClone` of `config` with `agents.reviewer` replaced by the resolved per-type pins (`{ model, thinking, plan: {...}, code: {...}, final: {...} }`) from `resolveEffectiveReviewer(config, { promptReviewerProfile: prompt.reviewerProfile, workerProfile: workerContext.profile, workerModel: workerContext.model })`. Pure, no I/O.
2. **Engine wiring** in `runNonMatrixTaskOnLane` (`src/batch/engine-lanes.mjs`): load the task's parsed PROMPT (reuse the packet already loaded for the lane if available; otherwise `parsePrompt` on the worktree PROMPT.md), compute the review config once before the plan review, and pass `config: reviewConfig` to the three review phases. Apply the same in `src/batch/resume-lane-reviews.mjs` so resumed reviews match.
3. **Family guard at runtime** — when `blocked` has an entry for a review type that will run, do not spawn: journal `review.blocked` `{ taskId, reviewType, reason, workerModel, reviewerModel }`, set `task.exitReason = "<type>_review_blocked"`, and fail the task with classification `review_blocked` and a message naming the config fix (`set agents.profiles.<workerProfile>.reviewerProfile or agents.reviewerProfile to a profile from another model family`). Register `review.blocked` in `src/batch/journal.mjs`. Warnings are journaled once per task as `review.reviewer_resolved` `{ taskId, plan, code, final, warnings }`.
4. **Journal effective reviewer** — in `src/batch/review-step-run.mjs`, add `reviewerModel` and `reviewerThinking` to the `review.started` payload, read with `resolveReviewerModelPin` / `resolveReviewerThinkingPin` from the `config` it receives (now the per-task review config). `null` means inherit.
5. **Docs** — operator runbook section "Reviewer profiles" (precedence, family rule, PROMPT field, `agents.reviewerProfile`, `profiles.<name>.reviewerProfile`, `review.blocked` recovery) and the three PROMPT fields in the authoring prompt template.

## Dependencies

- **Requires:** SP-832 (resolver and family helper)
- **Requires:** SP-833 (parsed `profile` / `reviewerProfile` fields)

## Context to Read First

- GitHub #355
- `src/batch/engine-lanes.mjs` 230-440
- `src/batch/resume-lane-reviews.mjs` (whole file)
- `src/batch/review-step-run.mjs` 60-200
- `src/batch/engine-lanes/quota-fallback-state.mjs` 120-205
- `src/config/agent-model-resolve.mjs`, `src/config/model-family.mjs` (SP-832)
- `src/batch/journal.mjs` ~40-60 and ~440-450 (event registration)
- `tests/batch/review-spawn.test.mjs`, `tests/batch/quota-fallback-integration.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/engine-lanes/task-agent-profile.mjs`
- `src/batch/engine-lanes.mjs`
- `src/batch/resume-lane-reviews.mjs`
- `src/batch/review-step-run.mjs`
- `src/batch/journal.mjs`
- `tests/batch/task-agent-profile.test.mjs`
- `tests/batch/engine-reviewer-profile.test.mjs`
- `docs/adoption/operator-runbook.md`
- `skills/create-spine-tasks/references/prompt-template.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/task-agent-profile.test.mjs tests/batch/engine-reviewer-profile.test.mjs tests/batch/review-spawn.test.mjs tests/batch/review-retry-reconcile.test.mjs tests/batch/quota-fallback-integration.test.mjs tests/batch/engine.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-834` |
| fileScopeMustChange | `src/batch/engine-lanes/task-agent-profile.mjs`, `src/batch/engine-lanes.mjs`, `src/batch/review-step-run.mjs`, `tests/batch/task-agent-profile.test.mjs`, `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `runNonMatrixTaskOnLane`, `runPlanReviewPhase`, `runCodeReviewPhase`, `runFinalReviewPhase`, `runStepReview` — record callers in Discoveries
- [ ] Find where the lane's parsed PROMPT is available (queue packet vs re-parse) and record it

### Step 1: Task agent context helpers

- [ ] `resolveTaskWorkerProfile` and `buildTaskReviewConfig` (pure)

**Artifacts:**
- `src/batch/engine-lanes/task-agent-profile.mjs` (new)

### Step 2: Engine + resume wiring and runtime guard

- [ ] Review phases receive the per-task review config (fresh run and resume)
- [ ] `review.blocked` fails the task before spawning; `review.reviewer_resolved` journaled
- [ ] `review.started` carries `reviewerModel` / `reviewerThinking`

**Artifacts:**
- `src/batch/engine-lanes.mjs` (modified)
- `src/batch/resume-lane-reviews.mjs` (modified)
- `src/batch/review-step-run.mjs` (modified)
- `src/batch/journal.mjs` (modified)

### Step 3: Tests

- [ ] Helpers: PROMPT reviewer profile wins; worker profile `reviewerProfile` used when PROMPT absent; `agents.reviewerProfile` default; per-type plan/code/final pins differ correctly
- [ ] Quota fallback hop to a Gemini worker switches the reviewer to the fallback profile's `reviewerProfile` (cross-family)
- [ ] Same-family with no alternative → `review.blocked`, no reviewer spawn (stub engine run)
- [ ] `review.started` payload includes reviewer model/thinking

**Artifacts:**
- `tests/batch/task-agent-profile.test.mjs` (new)
- `tests/batch/engine-reviewer-profile.test.mjs` (new)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Runbook "Reviewer profiles" section and prompt-template fields
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-834-engine-reviewer-profile-wiring/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-834`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — "Reviewer profiles" section
- `skills/create-spine-tasks/references/prompt-template.md` — `**Profile:**`, `**Thinking:**`, `**Reviewer Profile:**` header fields

**Check If Affected:**
- `docs/QUICK-REFERENCE.md`

## Completion Criteria

- [ ] Plan, code and final engine reviews use the per-task effective reviewer per review type
- [ ] A same-family pairing never spawns a reviewer; it fails with `review_blocked`
- [ ] Journal shows the effective reviewer model on review spawn events

## Git Commit Convention

- `feat(SP-834): engine reviews use effective reviewer profile with family guard (#355)`

## Do NOT

- Change the worker's model/thinking (SP-835)
- Change `resolveEffectiveReviewer` precedence (SP-832) — file a Discovery instead
- Write run-metrics reviewer rows (SP-837)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
