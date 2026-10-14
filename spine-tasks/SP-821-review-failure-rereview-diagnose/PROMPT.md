# Task: SP-821 — Diagnose recommends re-review, not salvage, when a review never ran

**Created:** 2026-10-10
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Diagnosis precedence and suggested commands. Partly reverses SP-762 (#291), which routed post-`.DONE` plan-review spawn failures to salvage on purpose. Getting it wrong either re-runs a finished worker or keeps landing unreviewed code.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0
**Problem theory:** A reviewer that fails to spawn, times out, or hits a provider error produces no verdict. When the lane already has `.DONE`, diagnose currently says `pending_lane_land` and suggests `spine batch salvage … --integrate`, which lands code no reviewer saw. Two paths do this:
- `findPostDonePlanReviewSpawnFailedTask` (`src/batch/reconcile-diagnosis.mjs` 137-179, used at ~281-291) maps `plan_review_spawn_failed` / `plan_review_timeout` with done evidence to `pending_lane_land` (SP-762).
- `shouldDiagnosePendingLaneLand` (`src/batch/diagnosis-pending-lane.mjs` 51-63) fires for any `doneInLane && !doneOnMain` task once the orch branch looks merged and reconcile marked the task terminal-success (`done_in_lane_terminal`), regardless of why it failed.
`spine batch retry <taskId>` on a failed task whose lane is finished resumes at the review, not the worker: the journal shows `review.resumed` (`src/batch/review-artifacts.mjs` 338-350, `src/batch/engine-lanes/review-poll.mjs` 296-310). The v2.27.0 manifest records SP-808 recovering this way twice. #331 notes the plan-review case re-enters the Step 0 plan review. The `needs_retry` headline for review spawn failures already exists (`src/batch/diagnosis.mjs` 105-110, ~179-190) but does not include plan-review or provider-error reasons. SP-820 adds the exit reasons `plan_review_provider_error`, `code_review_provider_error`, and `final_review_provider_error`.

## Mission

Partial #334 — For a failed task whose lane work is done but whose engine review produced no verdict, `spine status --diagnose` recommends re-running the review, not `salvage --integrate`.

1. **Review-infrastructure exit reasons** — one exported set in `src/batch/reconcile-diagnosis.mjs` (or a new small module if that keeps imports acyclic): `{plan,code,final}_review_spawn_failed`, `{plan,code,final}_review_timeout`, `{plan,code,final}_review_provider_error`. Replace `POST_DONE_PLAN_REVIEW_EXIT_REASONS` and `REVIEW_SPAWN_FAILURE_EXIT_REASONS` (`diagnosis.mjs`) with it.
2. **Diagnosis** (`src/batch/reconcile-diagnosis.mjs`): a failed task with done evidence and an exit reason in that set → `needs_retry` for that task (not `pending_lane_land`). Rename the SP-762 helper to match (for example `findPostDoneReviewInfraFailedTask`) and cover all three review types.
3. **Pending-lane guard** (`src/batch/diagnosis-pending-lane.mjs`): `shouldDiagnosePendingLaneLand` returns `false` when every pending-lane task's primary failure exit reason is in that set. Resolve the exit reason the same way `findPostDonePlanReviewSpawnFailedTask` does (task entry, else `resolvePrimaryFailureExitReason`). A lane with any other pending task keeps today's salvage guidance.
4. **Headline and command** (`src/batch/diagnosis.mjs`, `src/batch/diagnosis-suggested-command.mjs`):
   - Headline: `<batch> <type> review produced no verdict for task <id> (lane work is done) — re-run the review`. Provider-error reasons say `<type> review hit a provider error` and add `— run spine doctor`.
   - `suggestedCommand`: `spine batch retry <taskId>` (resumes at the review). It must never be a `salvage` command for these reasons.
   - Alternatives (`src/batch/diagnosis-alternatives.mjs`): keep `spine batch salvage --batch <id> --dry-run` as an alternative only, labeled as landing unreviewed work.
5. **Tests**:
   - Update `tests/batch/post-done-plan-review-spawn.test.mjs` and `tests/batch/salvage-final-review-spawn-failed.test.mjs` to the new expectation (`needs_retry`, retry command, no salvage). Record the SP-762 reversal in Discoveries.
   - New `tests/batch/diagnosis-review-infra-rereview.test.mjs`: for each review type × {spawn_failed, timeout, provider_error} with `doneInLane: true` → `needs_retry`, command `spine batch retry <id>`, headline mentions re-running the review; a provider-error case mentions `spine doctor`; a pending-lane task with exit reason `contract_failed` (or no failure) still gets `pending_lane_land`.

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh default`, which reviews this task's diff with stet (`.review/config.toml`: `qwen/qwen3.8-27b` on LM Studio with the OpenJev critic). When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>` (`false_positive`, `already_correct`, `wrong_suggestion`, `out_of_scope`), citing lint/typecheck/test evidence. Record stet reviewer bugs (invented syntax errors, stale hunks, parse failures) under Discoveries in STATUS.md. Never dismiss a real defect without fixing it. If stet itself fails (`stet doctor`), record a blocker; do not edit `.review/`.

## Dependencies

- **Task:** SP-820 (adds the `*_review_provider_error` exit reasons)

## Context to Read First

- GitHub #334 ("Where spine is fragile" item 4, "Proposed solution" item 4, acceptance criterion 4); #291; #331
- `src/batch/reconcile-diagnosis.mjs` 120-300; `src/batch/diagnosis-pending-lane.mjs`
- `src/batch/diagnosis.mjs` 100-200; `src/batch/diagnosis-suggested-command.mjs` 80-100; `src/batch/diagnosis-alternatives.mjs`
- `src/batch/review-artifacts.mjs` 330-410 (`review.resumed`)
- `spine-tasks/SP-762-post-done-plan-review-spawn-class/PROMPT.md` (behavior being replaced)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) and OpenJev System One at `http://127.0.0.1:8080`, for the stet step of the Contract only (unit tests need neither)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/reconcile-diagnosis.mjs`
- `src/batch/diagnosis-pending-lane.mjs`
- `src/batch/diagnosis.mjs`
- `src/batch/diagnosis-suggested-command.mjs`
- `src/batch/diagnosis-alternatives.mjs`
- `tests/batch/post-done-plan-review-spawn.test.mjs`
- `tests/batch/salvage-final-review-spawn-failed.test.mjs`
- `tests/batch/diagnosis-review-infra-rereview.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/diagnosis*.test.mjs tests/batch/post-done-plan-review-spawn.test.mjs tests/batch/salvage-final-review-spawn-failed.test.mjs tests/batch/salvage-complete-after-integrate.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh default` |
| fileScopeMustChange | `src/batch/reconcile-diagnosis.mjs`, `src/batch/diagnosis-pending-lane.mjs`, `tests/batch/diagnosis-review-infra-rereview.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `deriveDiagnosis`, `shouldDiagnosePendingLaneLand`, and `findPostDonePlanReviewSpawnFailedTask` — record callers in Discoveries
- [ ] Confirm from code that `spine batch retry <id>` on a failed task with lane `.DONE` resumes at the review (emits `review.resumed`) and does not re-run the worker. If it re-runs the worker, stop and record a blocker
- [ ] `rg -n 'salvage' tests/batch/*diagnos* tests/batch/*review-spawn* tests/batch/salvage-*` — list tests whose expectations change; add any missing ones to the Contract run (Amendments if outside File Scope)
- [ ] Dependencies satisfied (SP-820 exit reasons on `main`)

### Step 1: Exit-reason set and diagnosis

- [ ] Shared review-infrastructure set
- [ ] Post-done review failure → `needs_retry`
- [ ] Pending-lane guard

**Artifacts:**
- `src/batch/reconcile-diagnosis.mjs` (modified)
- `src/batch/diagnosis-pending-lane.mjs` (modified)

### Step 2: Headline, command, alternatives

- [ ] Re-review headline (provider-error variant mentions `spine doctor`)
- [ ] `spine batch retry <id>`; salvage only as a labeled alternative

**Artifacts:**
- `src/batch/diagnosis.mjs` (modified)
- `src/batch/diagnosis-suggested-command.mjs` (modified)
- `src/batch/diagnosis-alternatives.mjs` (modified)

### Step 3: Tests

- [ ] Update the two SP-762/SP-718-era tests
- [ ] New matrix test

**Artifacts:**
- `tests/batch/post-done-plan-review-spawn.test.mjs` (modified)
- `tests/batch/salvage-final-review-spawn-failed.test.mjs` (modified)
- `tests/batch/diagnosis-review-infra-rereview.test.mjs` (new)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review; triage per Mission)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md (include the SP-762 reversal)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-825 updates the runbook)

**Check If Affected:**
- None

## Completion Criteria

- [ ] `spine status --diagnose` for a review spawn, timeout, or provider failure with `.DONE` in the lane recommends re-review, not `salvage --integrate`
- [ ] Pending-lane salvage guidance for other failures is unchanged
- [ ] #330 live-engine guard (SP-815) still holds

## Git Commit Convention

- `fix(SP-821): diagnose recommends re-review for review-infra failures (#334)`

## Do NOT

- Edit `src/batch/reconcile-batch.mjs` (at the line cap) or change the reconcile `done_in_lane_terminal` rule
- Change `spine batch retry` or `spine batch salvage` behavior — this task changes recommendations only
- Change the #330 live-engine guard (`isLiveEngineMidTask`)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- **2026-10-11 (operator, SP-828 stet adoption):** Contract `testCommand` ends with `bash scripts/spine-stet-contract-run.sh default`; added `fileScopeMustNotChange` `.review/**`, the LM Studio and OpenJev services, and the stet triage paragraph in Mission. SP-828 is an indirect dependency via SP-820. To stay under the 500-character `testCommand` limit, the four `diagnosis*` tests (including the new `diagnosis-review-infra-rereview`) are now matched by `tests/batch/diagnosis*.test.mjs`, which also runs the other diagnosis suites.
- **2026-10-14 (operator, packet audit):** Removed the coverage gate (#342: S packets use scoped tests; post-integrate `release:check` owns coverage). Added `--test-reporter=dot` to the Contract.
