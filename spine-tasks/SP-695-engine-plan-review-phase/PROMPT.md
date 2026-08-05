# Task: SP-695 — Engine-owned plan review phase after worker .DONE

**Created:** 2026-08-03
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Adds engine-owned `runPlanReviewPhase` into the post-`.DONE` review pipeline (HIGH blast radius via `runTaskOnLane` + resume). Mirror existing code/final patterns; honor `agents.reviewer.plan`.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Mission

Closes #250 — Real-pi batches never run plan review: in-worker plan spawn is skipped (`nested_spawn_blocked`), and the engine only runs code (RL≥2) and final (RL≥1) after `.DONE`. Add engine-owned `runPlanReviewPhase` (mirror `runCodeReviewPhase` / `runFinalReviewPhase`), wire it before code/final on the success path and on resume, honor `agents.reviewer.plan` pins, and align skip-message / runbook claims that the engine runs plan after `.DONE`.

**Hard requirement:** For Review Level ≥ 1, plan review must actually execute (journal `review.completed` with `reviewType=plan`, or equivalent honor path) — not only an in-worker skip.

## Dependencies

- **None**

## Context to Read First

- `src/batch/engine-lanes/review.mjs` — `runCodeReviewPhase` / `runFinalReviewPhase` patterns to mirror
- `src/batch/engine-lanes.mjs` — post-`.DONE` review calls (~code then final only today)
- `src/batch/resume-lane-reviews.mjs` — resume must also run plan
- `src/batch/review-shared.mjs` — `isReviewTypeRequired(..., "plan")` for RL≥1
- `src/batch/review-spawn.mjs` — `NESTED_REVIEW_SPAWN_BLOCKED` messaging
- `tests/batch/engine-code-review.test.mjs`, `tests/batch/resume-lane-reviews.test.mjs`
- `docs/adoption/operator-runbook.md` — plan review / nested-spawn claims
- GitHub #250
- Manifest: `spine-tasks/_authoring/release-v2.12.3/manifest.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/review.mjs`
- `src/batch/engine-lanes.mjs`
- `src/batch/resume-lane-reviews.mjs`
- `tests/batch/engine-code-review.test.mjs`
- `tests/batch/resume-lane-reviews.test.mjs`
- `tests/batch/final-review-honor.test.mjs`
- `tests/batch/final-verdict.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/engine-code-review.test.mjs tests/batch/resume-lane-reviews.test.mjs tests/batch/final-review-honor.test.mjs tests/batch/final-verdict.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/review.mjs`, `src/batch/engine-lanes.mjs`, `src/batch/resume-lane-reviews.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm `isReviewTypeRequired(level, "plan")` is true for RL≥1
- [ ] Confirm post-`.DONE` path calls only `runCodeReviewPhase` then `runFinalReviewPhase`
- [ ] Confirm `resume-lane-reviews.mjs` mirrors that gap
- [ ] Confirm no existing `runPlanReviewPhase` export

### Step 1: Add runPlanReviewPhase and wire callers

- [ ] Implement `runPlanReviewPhase` in `review.mjs` mirroring code/final (RL gate, honor existing plan artifact, spawn with `agents.reviewer.plan`, journal events, fail-closed on REVISE/REPLAN)
- [ ] Export `runPlanReviewPhase` alongside code/final
- [ ] Call plan phase **before** code/final in `engine-lanes.mjs` after worker success
- [ ] Call plan phase **before** code/final in `resume-lane-reviews.mjs`
- [ ] Align nested-spawn skip messaging / runbook so claims match engine-owned plan behavior

### Step 2: Testing & Verification

- [ ] Extend or add tests proving RL≥1 runs plan phase after `.DONE` (stub path) and resume path includes plan
- [ ] Update `tests/batch/final-review-honor.test.mjs` and `tests/batch/final-verdict.test.mjs` stub verdict sequences so the added plan review consumes its own verdict (5 known failures — see Amendments)
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code

### Step 3: Documentation & Delivery

- [ ] Update `docs/adoption/operator-runbook.md` so engine-owned plan after `.DONE` is accurate
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — plan review after `.DONE` / nested_spawn_blocked engine claim

**Check If Affected:**
- `src/batch/worker-prompt.mjs` — only if skip text still claims engine runs plan incorrectly

## Completion Criteria

- [ ] `runPlanReviewPhase` exists and is invoked for RL≥1 after worker success
- [ ] Resume path also runs plan before code/final
- [ ] `agents.reviewer.plan` pins are used for the plan phase
- [ ] Runbook / skip messaging no longer claim engine plan when it was missing
- [ ] Scoped + full tests green

## Do NOT

- Change nested-spawn block policy for in-worker reviewers (SP-195) beyond messaging alignment
- Rewrite code/final review semantics
- Touch matrix scheduling (`matrix-run.mjs`) — that is SP-697/SP-698
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-695): engine-owned plan review phase after worker success (#250)`

## Amendments (Added During Execution)

- **2026-08-05 (retry 2 recovery):** The first two attempts ended `worker_done_missing`. Implementation and scoped tests were green, but the added plan phase consumes a stub reviewer verdict that `tests/batch/final-review-honor.test.mjs` and `tests/batch/final-verdict.test.mjs` expected the final phase to receive, so the full suite failed 5 tests in files outside the original File Scope (2352 pass / 5 fail). Both files are now in File Scope and in the Contract `testCommand`. Fix those stub verdict sequences — do not weaken the plan phase to satisfy them.
