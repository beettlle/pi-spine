# Task: SP-850 — Diagnose: a task in review is not state drift; no `resume --force` while the engine is live

**Created:** 2026-11-01
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** `--diagnose` drives operator and agent recovery. A false `state_drift` that recommends `spine batch resume --force` on a live batch restarts a task mid-review.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `detectBatchStateDrift` (`src/batch/journal-rebuild-drift.mjs` ~226-272) pushes a `doneInLane` drift entry when the cached status is `pending|running`, the classifier sees `.DONE` in the lane (`classifiedShowsDoneInLaneDrift` ~44-51), and the task's last lifecycle event is not terminal (`JOURNAL_TERMINAL_LIFECYCLE` ~21-27). The worker writes `.DONE` **before** the engine runs code/final review and contract verify, so every task in post-`.DONE` review matches. `deriveDiagnosis` (`src/batch/reconcile-diagnosis.mjs` ~161-164) then returns `state_drift`, and `diagnosis-suggested-command.mjs` (~63-79) returns `spine batch resume --force` whenever `ctx.phase === "running"`. Seen in #356 (batch `20261017T222827-fb0f`, SP-052 between `review.started` 00:02:40Z and `task.completed` 00:19:59Z) and in #371's batch during contract verify.

## Mission

Closes #356 — A task that is in engine review or contract verification after `.DONE` is reported as in progress, not drift, and `--diagnose` never recommends `resume --force` for a live engine:

1. **Drift** — In `detectBatchStateDrift`, skip the `doneInLane` entry when the task's journal shows post-`.DONE` engine work still open: a `review.started` with no later `review.completed` for that task, or a contract verification start with no later result (use the event names the engine actually journals; confirm in `src/batch/journal.mjs`). Real drift (terminal journal, stale cache) is still reported.
2. **Suggested command** — For `state_drift` with `phase === "running"` and the engine PID alive (`staleEnginePid !== true` and `engineDead !== true`), suggest `spine wait --until completed,failed,needs_integrate,needs_retry --timeout 2h` instead of `spine batch resume --force`. Stale or dead engine keeps `resume --force` (SP-512 / #196).
3. **Tests** — open code review, open final review, and open contract verify after `.DONE` → no drift; review completed but cache still `running` with terminal journal → drift as before; live-engine `state_drift` → `spine wait …`; dead-engine `state_drift` → `spine batch resume --force`.

## Dependencies

- **None**

## Context to Read First

- GitHub #356
- `src/batch/journal-rebuild-drift.mjs` 1-60, 226-272
- `src/batch/reconcile-diagnosis.mjs` 125-175
- `src/batch/diagnosis-suggested-command.mjs` 40-90
- `src/batch/journal.mjs` (registered event types: `review.started`, `review.completed`, contract events)
- `tests/batch/journal-rebuild-drift.test.mjs`, `tests/batch/spine-diagnosis-state-drift.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio + OpenJev for the stet `reviewCommand` only
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/journal-rebuild-drift.mjs` — 397 lines; the open-review check goes in a small helper in this file (net ≤ +30)
- `src/batch/diagnosis-suggested-command.mjs`
- `tests/batch/journal-rebuild-drift.test.mjs`
- `tests/batch/spine-diagnosis-state-drift.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/journal-rebuild-drift.test.mjs tests/batch/spine-diagnosis-state-drift.test.mjs tests/batch/retry-state-drift.test.mjs tests/batch/reconcile-done-inlane-terminal.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-850` |
| fileScopeMustChange | `src/batch/journal-rebuild-drift.mjs`, `tests/batch/journal-rebuild-drift.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `detectBatchStateDrift` and the suggested-command builder; report the blast radius in STATUS
- [ ] `rg -n "resume --force" tests/` — every test that asserts the current `state_drift` suggestion is in the Contract or listed in Discoveries for post-integrate `release:check`
- [ ] Confirm the review and contract event names in `src/batch/journal.mjs`

### Step 1: Drift skip for open post-`.DONE` work

- [ ] Helper: task has an open review or contract verification in the journal
- [ ] `doneInLane` drift skipped only in that case

**Artifacts:**
- `src/batch/journal-rebuild-drift.mjs` (modified)

### Step 2: Live-engine suggestion

- [ ] `state_drift` + running phase + live engine → `spine wait …`; stale/dead engine unchanged

**Artifacts:**
- `src/batch/diagnosis-suggested-command.mjs` (modified)

### Step 3: Tests

- [ ] Open code / final review and open contract verify → no drift
- [ ] Terminal journal with stale cache → drift
- [ ] Suggested command: live → `spine wait …`; dead/stale → `spine batch resume --force`

**Artifacts:**
- `tests/batch/journal-rebuild-drift.test.mjs`, `tests/batch/spine-diagnosis-state-drift.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-850-diagnose-review-not-drift/.DONE`

**Stet review (Contract `reviewCommand`, blocking):** fix real defects in this task's diff. For a stet false positive, `stet dismiss <id> <reason>` citing lint/typecheck/test evidence, record it under Discoveries, and file it at https://github.com/beettlle/stet/issues. Never edit `.review/` or remove the `reviewCommand`.

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` `state_drift` recovery row (note in Discoveries; do not edit)

## Completion Criteria

- [ ] No `state_drift` for a task with open post-`.DONE` review or contract verification
- [ ] No `resume --force` suggestion while the engine is live

## Git Commit Convention

- `fix(SP-850): task in engine review is not state drift; live engine suggests wait`

## Do NOT

- Change real-drift detection for terminal journals
- Suggest `--attached` anywhere (#196)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
