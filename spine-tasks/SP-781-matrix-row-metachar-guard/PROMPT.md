# Task: SP-781 — Matrix row runtime metachar guard

**Created:** 2026-09-27
**Size:** S

## Review Level: 2 (Plan and Code)

**Risk:** Security boundary — matrix row values reach `/bin/sh -c` unguarded today.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 0, Security: 2, Reversibility: 1
**Problem theory:** `runMatrixSubLane` substitutes row values into the execute command template *after* the parse-time metacharacter check, then spawns the result with `runShellInDir`. `parse-prompt.mjs` documents the runtime guard as the enforcement boundary, but only `runContractTestCommand` applies it. A row value like `a; printf PWNED` runs a second command.

## Mission

Partial #297 — Refuse a matrix execute row before spawn when the substituted command contains shell metacharacters.

1. In `src/batch/engine-lanes/matrix-run.mjs`, right after `substituteRowCommand(rawCommand, values)` in the `matrixType === "execute"` branch, call `isRefusedContractMetacharCommand(command)` (from `src/tasks/packet/parse-prompt.mjs`).
2. When it matches, do **not** call `runShellInDir`. Produce a failed row result (`ok: false`, `exitCode: 1`) whose `output` is a matrix-specific refusal message naming the row id and the detected issue (reuse `formatRefusedContractMetacharMessage` or a sibling formatter; say "matrix row command refused before spawn"). The existing failed-row path then journals `matrix.sub_lane.failed`.
3. `&&` chains in the template stay allowed (same grammar as #268).
4. Tests: a row value containing `;`, `$(`, a backtick, or `&` (lone) fails before spawn — assert no side-effect file is created and `matrix.sub_lane.failed` is journaled. Add a metachar-in-value case to `tests/batch/contract-matrix-subst.test.mjs`.

SP-783 adds the timeout and output cap to `runShellInDir` separately (disjoint file).

## Dependencies

- **None**

## Context to Read First

- `src/batch/engine-lanes/matrix-run.mjs` — execute branch (~lines 240–260) and failed-row journaling (~line 434)
- `src/tasks/packet/parse-prompt.mjs` — `isRefusedContractMetacharCommand`, `formatRefusedContractMetacharMessage` (~lines 118–146)
- `src/batch/contract-exec.mjs` — reference use of the guard (~line 164)
- `tests/batch/matrix-execution.test.mjs` — existing execute-matrix fixtures (reuse helpers; do not grow this 2000-line file)
- GitHub #297; related #268, #229

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`)

## File Scope

- `src/batch/engine-lanes/matrix-run.mjs`
- `tests/batch/matrix-row-command-guard.test.mjs`
- `tests/batch/contract-matrix-subst.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/matrix-row-command-guard.test.mjs tests/batch/contract-matrix-subst.test.mjs tests/batch/matrix-execution.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/matrix-run.mjs`, `tests/batch/matrix-row-command-guard.test.mjs` |
| fileScopeMustNotChange | `src/batch/engine-lanes/matrix.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce: row value `a; printf PWNED` executes at HEAD (unit-level via `substituteRowCommand` + guard check)
- [ ] Dependencies satisfied

### Step 1: Runtime guard

- [ ] Guard runs after substitution, before `runShellInDir`
- [ ] Refused row: `ok: false`, `exitCode: 1`, matrix-specific message with row id and issue
- [ ] `&&` chains still allowed
- [ ] Tests: `;`, `$(`, backtick, lone `&` in a row value → no spawn, no side effect, `matrix.sub_lane.failed` journaled
- [ ] Metachar-in-value case in `contract-matrix-subst.test.mjs`

**Artifacts:**
- `src/batch/engine-lanes/matrix-run.mjs` (modified)
- `tests/batch/matrix-row-command-guard.test.mjs` (new)
- `tests/batch/contract-matrix-subst.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-789 owns runbook edits)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §2.4 Matrix tasks

## Completion Criteria

- [ ] Metachar row values fail the row before spawn with a clear message
- [ ] Existing matrix e2e fixtures still pass
- [ ] Partial #297 (SP-783 closes)

## Git Commit Convention

- `fix(SP-781): refuse matrix row commands with shell metacharacters (#297)`

## Do NOT

- Edit `src/batch/engine-lanes/matrix.mjs` (SP-783 owns `runShellInDir`)
- Escape or quote values as the fix — refuse before spawn
- Switch matrix execution to argv form (out of scope per #297)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
