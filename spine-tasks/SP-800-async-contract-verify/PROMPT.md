# Task: SP-800 — Async contract verification (no spawnSync or Atomics.wait on the contract path)

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Contract verify gates every lane's completion; a missed `await` makes every verify look like a pass or a crash.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** `runContractTestCommand` / `verifyContract` (`src/batch/contract-exec.mjs`, wrapped by `src/batch/contract-verify.mjs` ~58) run synchronously: `spawnSync` with a 10-minute timeout, a retry loop (~340-370) that sleeps with `sleepSync` (`Atomics.wait`, ~91-94), and a coverage fallback (~229) that also omits the `maxBuffer` override. The `git diff --name-only HEAD` call (~321) has no timeout and Node's 1 MB default buffer. Engine callers `src/batch/engine-lanes/review-final.mjs` ~304 and `src/batch/engine-lanes/matrix-run.mjs` ~322 run inside `Promise.all` lane execution, so one slow check freezes every lane for 20+ minutes.

## Mission

Closes #305 — Contract verification is async end to end, timeouts are killed and reported as timeouts, and no `spawnSync` or `Atomics.wait` remains on the contract path.

1. **Async runner**: `runContractTestCommand` becomes `async` and uses `runShellCommandAsync` from `src/batch/contract-spawn.mjs` (SP-799), keeping its current result fields and adding `timedOut`. When `timedOut`, the reported output/error says `timed out after N min` instead of exit code 1.
2. **Async verify**: `verifyContract` (both `contract-exec.mjs` and the `contract-verify.mjs` wrapper) becomes `async`. Replace `sleepSync` with `await setTimeout(ms)` from `node:timers/promises` and delete `sleepSync`. Pass `maxBuffer` to the coverage fallback. Give the `git diff --name-only HEAD` call a timeout (30 s) and a `maxBuffer` of `CONTRACT_TEST_COMMAND_MAX_BUFFER`.
3. **Await callers**: `review-final.mjs` ~304 and `matrix-run.mjs` ~322 `await verifyContract(...)` (both enclosing functions are already async — confirm in Step 0). `rg -n "verifyContract\(|runContractTestCommand\(" src bin` must show no un-awaited call.
4. **Tests**: update the 14 test files that call these functions to `await` (list below); add to `tests/batch/contract-verify-async.test.mjs`: slow contract (`sleep 2`) with a concurrent `setInterval` counter advancing; a timed-out contract reports `timedOut: true` and the timeout message. `contract-exec.mjs` must stay ≤ 500 lines.

Test files calling these functions today: `contract-prelanded`, `contract-verify-worker-env`, `contract-verify-npm-scope`, `contract-base-satisfied`, `contract-verify-resume`, `contract-exec`, `contract-verify`, `contract-untracked-files`, `contract-retry`, `contract-verify-serialized`, `contract-matrix-subst`, `flutter-analyzer-hygiene`, `contract-resume-baseline`, `contract-verify-buffer` (all under `tests/batch/`, `.test.mjs`).

## Dependencies

- **Task:** SP-799 (`runShellCommandAsync` in `src/batch/contract-spawn.mjs`)

## Context to Read First

- GitHub #305
- `src/batch/contract-spawn.mjs` (from SP-799)
- `src/batch/contract-exec.mjs` — `runContractTestCommand` (~155), `verifyContract` (~311), retry loop (~340-370), coverage fallback (~229), `git diff` (~321)
- `src/batch/contract-verify.mjs` ~58-78
- `src/batch/engine-lanes/review-final.mjs` ~290-320, `src/batch/engine-lanes/matrix-run.mjs` ~310-340

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/contract-exec.mjs`
- `src/batch/contract-verify.mjs`
- `src/batch/engine-lanes/review-final.mjs`
- `src/batch/engine-lanes/matrix-run.mjs`
- `tests/batch/contract-verify-async.test.mjs`
- `tests/batch/contract-prelanded.test.mjs`
- `tests/batch/contract-verify-worker-env.test.mjs`
- `tests/batch/contract-verify-npm-scope.test.mjs`
- `tests/batch/contract-base-satisfied.test.mjs`
- `tests/batch/contract-verify-resume.test.mjs`
- `tests/batch/contract-exec.test.mjs`
- `tests/batch/contract-verify.test.mjs`
- `tests/batch/contract-untracked-files.test.mjs`
- `tests/batch/contract-retry.test.mjs`
- `tests/batch/contract-verify-serialized.test.mjs`
- `tests/batch/contract-matrix-subst.test.mjs`
- `tests/batch/flutter-analyzer-hygiene.test.mjs`
- `tests/batch/contract-resume-baseline.test.mjs`
- `tests/batch/contract-verify-buffer.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/contract-*.test.mjs tests/batch/flutter-analyzer-hygiene.test.mjs tests/batch/engine.test.mjs` |
| fileScopeMustChange | `src/batch/contract-exec.mjs`, `src/batch/engine-lanes/review-final.mjs`, `src/batch/engine-lanes/matrix-run.mjs`, `tests/batch/contract-verify-async.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-799 landed
- [ ] Confirm both engine callers' enclosing functions are `async`
- [ ] `rg -n "spawnSync|sleepSync|Atomics" src/batch/contract-*.mjs` — baseline list
- [ ] Dependencies satisfied

### Step 1: Async runner + verify

- [ ] `runContractTestCommand` async on `runShellCommandAsync`; `timedOut` + message
- [ ] `verifyContract` async; `sleepSync` deleted; coverage fallback `maxBuffer`; `git diff` timeout + buffer
- [ ] `contract-exec.mjs` ≤ 500 lines

**Artifacts:**
- `src/batch/contract-exec.mjs`, `src/batch/contract-verify.mjs` (modified)

### Step 2: Engine callers

- [ ] `review-final.mjs` and `matrix-run.mjs` await verify
- [ ] No un-awaited call in `src` / `bin`

**Artifacts:**
- `src/batch/engine-lanes/review-final.mjs`, `src/batch/engine-lanes/matrix-run.mjs` (modified)

### Step 3: Tests

- [ ] 14 existing test files awaited
- [ ] New async/timeout tests

**Artifacts:**
- `tests/batch/contract-verify-async.test.mjs` (new), 14 test files (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] `rg -n "spawnSync|Atomics" src/batch/contract-*.mjs` returns nothing
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-803)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §2.3 Contract authoring

## Completion Criteria

- [ ] A slow contract on lane 1 does not stop lane 2's timers
- [ ] Timed-out contract commands are tree-killed and reported as timeouts
- [ ] No `spawnSync` or `Atomics.wait` on the contract path
- [ ] Closes #305

## Git Commit Convention

- `fix(SP-800): async contract verification (#305)`

## Do NOT

- Change contract semantics or retry counts
- Add matrix retry logging / `contract.test_retry` parity (follow-up)
- Change batch-state saves in `matrix-run.mjs` (SP-797)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
