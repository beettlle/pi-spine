# Task: SP-812 — Isolate test and worker commands from the live journal

**Created:** 2026-10-03
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Test hygiene plus one CLI guard. The guard must not block the legitimate worker `spine_review_step` (plan/code) journal path.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0
**Problem theory:** In batch `20260928T010710-9c1b` SP-801's contract command ran `node --test tests/batch/review.test.mjs` directly inside a worker. The worker env carries `SPINE_JOURNAL_ATTACH=1`, `SPINE_BATCH_ID`, `SPINE_PROJECT_ROOT`, `SPINE_TASK_ID` (`src/batch/worker-spawn.mjs` 91-101), and the runner passes that env to `pi` unchanged (`bin/spine-worker-runner.mjs` ~448). The test "runSpineReviewStep CLI --type final emits JSON verdict" (`tests/batch/review.test.mjs` 397-428) passes no `journal` and does not clear those vars, so `bin/spine-review-step.mjs` (~64 `options.journal ?? resolveBatchJournalContext()`) wrote a stub final `PASS` into the live journal under the real task ID. `npm test` sets `SPINE_SUPPRESS_JOURNAL_ATTACH=1`, a direct `node --test` does not. The legitimate worker tool (`extensions/spine/worker-tools.ts`) only requests `plan` / `code` reviews; engine final reviews call `runStepReview` in-process with an explicit journal, not the CLI.

## Mission

Partial #328 — Test processes and CLI final reviews can no longer write to a live batch journal through inherited worker env.

1. **CLI guard** (`bin/spine-review-step.mjs`): use the env-derived journal (`resolveBatchJournalContext()`) only for `--type plan` / `code`. For `--type final` without an explicit `options.journal`, do not journal. First confirm with `rg -n "spine-review-step|runSpineReviewStep" src bin extensions` that no engine path runs final reviews through the CLI; if one does, record a Blocker instead.
2. **Test helper** — new `tests/helpers/live-journal-env.mjs` exporting `LIVE_JOURNAL_ENV_KEYS` (`SPINE_JOURNAL_ATTACH`, `SPINE_BATCH_ID`, `SPINE_PROJECT_ROOT`, `SPINE_TASK_ID`, `SPINE_LANE_NUMBER`, `SPINE_LANE_CORRELATION_ID`) and `withoutLiveJournalEnv(env = process.env)` → copy without those keys and with `SPINE_SUPPRESS_JOURNAL_ATTACH: "1"`.
3. **Tests that inherit worker env:**
   - `tests/batch/review.test.mjs` 397-428: save/clear/restore the live-journal keys around the CLI call (or pass an explicit temp `journal`).
   - `tests/batch/stub-runner-delivery.test.mjs` (~100-109) and `tests/batch/worker-runner-done-missing.test.mjs` (~62-64, ~101-103): spawn with `withoutLiveJournalEnv(...)` instead of raw `...process.env`.
4. **Regression test** in `tests/batch/review.test.mjs`: with `SPINE_JOURNAL_ATTACH=1`, `SPINE_BATCH_ID`, `SPINE_PROJECT_ROOT` (temp root), `SPINE_TASK_ID` set and no `journal`, the CLI `--type final` writes **no** journal file/event; the same env with `--type plan` still journals (legit worker path preserved).

## Dependencies

- **None**

## Context to Read First

- GitHub #328
- `bin/spine-review-step.mjs` (126 lines), `src/batch/review-step.mjs` 284-309 (`isJournalAttachBlocked`, `resolveBatchJournalContext`)
- `src/batch/worker-spawn.mjs` 66-117; `extensions/spine/worker-tools.ts` 60-120
- `tests/batch/review.test.mjs` 397-450, `tests/batch/journal-attach.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `bin/spine-review-step.mjs`
- `tests/helpers/live-journal-env.mjs`
- `tests/batch/review.test.mjs`
- `tests/batch/stub-runner-delivery.test.mjs`
- `tests/batch/worker-runner-done-missing.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/review.test.mjs tests/batch/stub-runner-delivery.test.mjs tests/batch/worker-runner-done-missing.test.mjs tests/batch/journal-attach.test.mjs tests/batch/nested-reviewer-guard.test.mjs tests/worker-tools/review-step-tool.test.mjs` |
| fileScopeMustChange | `bin/spine-review-step.mjs`, `tests/helpers/live-journal-env.mjs`, `tests/batch/review.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm no engine path runs final reviews through the CLI
- [ ] Dependencies satisfied

### Step 1: CLI guard + helper

- [ ] Env-derived journal only for plan/code
- [ ] `withoutLiveJournalEnv` helper

**Artifacts:**
- `bin/spine-review-step.mjs` (modified), `tests/helpers/live-journal-env.mjs` (new)

### Step 2: Test isolation + regression

- [ ] Three tests isolated
- [ ] Final-with-attach writes nothing; plan-with-attach still journals

**Artifacts:**
- `tests/batch/review.test.mjs`, `tests/batch/stub-runner-delivery.test.mjs`, `tests/batch/worker-runner-done-missing.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run Contract `testCommand` again **without** `SPINE_SUPPRESS_JOURNAL_ATTACH=1` but with fake `SPINE_JOURNAL_ATTACH=1 SPINE_BATCH_ID=x SPINE_PROJECT_ROOT=$(mktemp -d)` — the temp root must contain no journal afterwards
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-811)

**Check If Affected:**
- None

## Completion Criteria

- [ ] A direct `node --test` run inside worker env cannot journal a final review
- [ ] Worker plan/code review journaling unchanged

## Git Commit Convention

- `fix(SP-812): keep test and CLI final reviews out of the live journal (#328)`

## Do NOT

- Strip journal env from the `pi` child in the worker runner (breaks `spine_review_step`)
- Edit `src/batch/contract-exec.mjs` (at the line cap; engine-run contracts already drop `SPINE_BATCH_ID`)
- Change engine honor logic (SP-813)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
