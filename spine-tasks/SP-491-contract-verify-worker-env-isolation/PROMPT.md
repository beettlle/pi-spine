# Task: SP-491 — Contract verify worker env isolation

**Created:** 2026-07-04
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Contract verification runs inside worker processes where `SPINE_IS_WORKER=1` is set; full-suite `testCommand` inherits that env and false-fails on pre-existing batch-spawn tests. Fix is localized to contract subprocess spawning.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Canonical Task Folder

```
spine-tasks/SP-491-contract-verify-worker-env-isolation/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

When contract verification runs `testCommand` inside a spine worker, the subprocess inherits `SPINE_IS_WORKER=1` from `worker-host.mjs`. Pre-existing tests that call `startBatch` hit the `nested_batch_spawn_blocked` guard in `engine.mjs` and fail — even when the task's own changes are correct and task-scoped tests pass. This caused false `contract_failed` outcomes during the v1.4.0 release batch.

Run contract `testCommand` in a **sanitized subprocess** that omits worker-only environment variables (at minimum `SPINE_IS_WORKER`), matching operator re-run behavior outside the worker. Add a regression test and update the operator runbook if behavior changes.

**Closes:** [#155](https://github.com/beettlle/pi-spine/issues/155)

## Dependencies

- **Task:** SP-494 (stet Option A bootstrap — worktree hook + `.review/config.toml`)

## Context to Read First

**Tier 2 (area context):**
- `spine-tasks/CONTEXT.md` — Phase 57–58

**Tier 3 (load only if needed):**
- `src/batch/contract-verify.mjs` — `runContractTestCommand`, `verifyContract`
- `src/batch/worker-host.mjs` — worker env vars set at spawn
- `src/batch/engine.mjs` — `nested_batch_spawn_blocked` guard (SP-482)
- `spine-tasks/SP-488-contract-failed-false-positive-docs/PROMPT.md` — operator-facing symptom docs (complementary)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `tests/batch/contract-verify-worker-env.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-verify-worker-env.test.mjs && npm run coverage:check && scripts/spine-stet-contract-run.sh default` |
| fileScopeMustChange | `src/batch/contract-verify.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/contract-verify-worker-env.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #155 acceptance criteria
- [ ] Read `runContractTestCommand` in `contract-verify.mjs`
- [ ] Confirm `SPINE_IS_WORKER=1` is set in worker spawn env

### Step 1: Add contract test env sanitizer

- [ ] Add `buildContractTestEnv(sourceEnv)` helper that copies `process.env` and **deletes** worker-only keys (`SPINE_IS_WORKER` at minimum; document any others stripped)
- [ ] Pass sanitized env to `spawnSync` in `runContractTestCommand`
- [ ] Export helper if tests need it

**Artifacts:**
- `src/batch/contract-verify.mjs` (modified)

### Step 2: Regression test

- [ ] Add `tests/batch/contract-verify-worker-env.test.mjs`
- [ ] Test: with `SPINE_IS_WORKER=1` in parent process, `runContractTestCommand` subprocess does not inherit it (verify via env-echo or mock)
- [ ] Test: contract verify with worker env + scoped passing `testCommand` returns ok (no false fail from nested spawn guard)

**Artifacts:**
- `tests/batch/contract-verify-worker-env.test.mjs` (new)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Coverage gate passes (≥77% line coverage on in-scope code): `npm run coverage:check`
- [ ] If `stet run` fails: fix code OR file GitHub issue(s) on beettlle/pi-spine (label `stet`) before marking done — see Stet findings policy in CONTEXT.md
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update `docs/adoption/operator-runbook.md` — note that contract `testCommand` runs in a sanitized subprocess (cross-link SP-488 troubleshooting if present)
- [ ] Close GitHub issue #155: `gh issue close 155 --comment "Fixed in SP-491 — contract testCommand subprocess strips SPINE_IS_WORKER"`
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — contract verify subprocess env behavior (if changed from SP-488 workaround narrative)

**Check If Affected:**
- `spine-tasks/SP-488-contract-failed-false-positive-docs/PROMPT.md` — may need cross-reference update if runbook section exists

## Completion Criteria

- [ ] All steps complete
- [ ] Contract verify passes in worker env when task-scoped tests pass
- [ ] Pre-existing `nested_batch_spawn_blocked` failures no longer cause `contract_failed` on full-suite `testCommand`
- [ ] Regression test covers worker-env isolation
- [ ] Issue #155 closed

## Git Commit Convention

- **Step completion:** `feat(SP-491): complete Step N — description`
- **Bug fixes:** `fix(SP-491): description`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Disable the `nested_batch_spawn_blocked` guard in workers (SP-482 must remain)
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
