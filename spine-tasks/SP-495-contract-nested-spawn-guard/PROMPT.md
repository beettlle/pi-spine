# Task: SP-495 — Contract verify nested batch spawn guard

**Created:** 2026-07-04
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Closes regression from SP-491 env sanitization; touches contract verify and batch engine guard paths. Release-blocking for real-pi batches.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Prevent contract `testCommand` subprocesses from spawning live nested batch engines inside lane worktrees ([#162](https://github.com/beettlle/pi-spine/issues/162)). SP-491 strips `SPINE_IS_WORKER` so integration tests pass, but batch-spawn tests (e.g. SP-348/SP-343 fixtures) can still launch `spine.mjs batch start` from worktree cwd and corrupt the parent batch.

Block nested batch CLI/engine start when a parent batch context is active (e.g. `SPINE_BATCH_ID` set on worker host), even in sanitized contract subprocess env. Add regression test proving contract verify leaves no live nested batch PIDs.

**Closes:** [#162](https://github.com/beettlle/pi-spine/issues/162)

## Dependencies

- **Task:** SP-491

## Context to Read First

**Tier 2:**
- `spine-tasks/_authoring/release-v1.6.0/manifest.md` — wave 0 recovery context

**Tier 3:**
- `src/batch/contract-verify.mjs` — `buildContractTestEnv`, `runContractTestCommand`
- `src/batch/engine.mjs` — `detectNestedWorkerContext`, `startBatch`
- `src/batch/worker-host.mjs` — worker/parent batch env
- GitHub issue #162

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `src/batch/engine.mjs`
- `bin/spine.mjs`
- `tests/batch/contract-verify-nested-spawn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-verify-nested-spawn.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/contract-verify.mjs` |
| artifactsMustExist | `tests/batch/contract-verify-nested-spawn.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #162
- [ ] Confirm SP-491 `.DONE` on branch
- [ ] Reproduce hypothesis: sanitized env + worktree cwd allows nested spawn

### Step 1: Parent-batch guard

- [ ] Extend nested spawn detection for contract subprocess (parent `SPINE_BATCH_ID` or equivalent)
- [ ] Ensure CLI `batch start/resume` paths honor guard when invoked from lane worktree

### Step 2: Regression test

- [ ] Add `tests/batch/contract-verify-nested-spawn.test.mjs`
- [ ] Assert contract verify subprocess cannot leave live nested batch PIDs

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update `docs/adoption/operator-runbook.md` — nested spawn during contract verify
- [ ] Comment on GitHub issue #162 with fix summary
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] Nested batch engines cannot start from contract verify subprocess in lane worktrees
- [ ] Regression test passes
- [ ] Issue #162 closed or Partial with follow-up noted

## Do NOT

- Disable SP-482 nested spawn guard in worker processes
- Expand scope beyond contract verify + engine guard paths
- Skip regression test
- Commit without SP-495 prefix in commit message

---

**Closes:** [#162](https://github.com/beettlle/pi-spine/issues/162)
