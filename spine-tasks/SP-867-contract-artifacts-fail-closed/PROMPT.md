# Task: SP-867 — Contract: reject .. in artifacts; fix ** globs; fail-closed on git diff failure

**Created:** 2026-11-18
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Contract evidence can fail open (must-not-change) or probe outside the lane (artifacts `..`); broken `**` globs force author workarounds.
**Score:** 5/8 — Blast radius: 3, Pattern novelty: 1, Security: 1, Reversibility: 0
**Problem theory:** `findArtifactMatch` walks from `path.dirname(pattern)` so `src/**` becomes a literal `src/**` directory; patterns with `..` resolve outside the worktree. When `git diff --name-only HEAD` fails, `indexAndWorktreeFiles` becomes `[]` and `fileScopeMustNotChange` passes.

## Mission

Closes #309 — Contract verification is fail-closed and glob-correct:

1. **Traversal** — Reject `artifactsMustExist` (and validation) patterns that contain `..` or resolve outside the lane worktree.
2. **`**` globs** — Patterns containing `**` match files under the worktree (picomatch over a proper search root), not a literal `**` directory segment from `path.dirname`.
3. **Git diff failure** — If `git diff --name-only HEAD` fails/times out, `fileScopeMustNotChange` must **fail** (not pass on empty). Journal or check message must mention the git failure. `fileScopeMustChange` stays fail-closed as today.
4. **Tests** — Cover `..` reject, `**` match hit, and git-diff failure → must-not-change fail.

## Dependencies

- **None**

## Context to Read First

- GitHub #309
- `src/batch/contract-exec.mjs` (`findArtifactMatch`, `verifyContract` git diff path)
- `tests/batch/contract-exec.test.mjs` / related contract verify tests
- Runbook owned by SP-865

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/contract-exec.mjs`
- `src/tasks/validate-contract-warn.mjs`
- `tests/batch/contract-exec.test.mjs`
- `tests/batch/contract-verify-async.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/contract-exec.test.mjs tests/batch/contract-verify-async.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-867` |
| fileScopeMustChange | `src/batch/contract-exec.mjs`, `tests/batch/contract-exec.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `findArtifactMatch` / `verifyContract`; report blast radius in STATUS
- [ ] `rg -n "findArtifactMatch|artifactsMustExist|fileScopeMustNotChange" src/batch/contract-exec.mjs tests/batch/`

### Step 1: Fail-closed contract checks

- [ ] Reject `..` / out-of-worktree artifact patterns
- [ ] Fix `**` glob search root
- [ ] Fail `fileScopeMustNotChange` when git diff fails

### Step 2: Tests

- [ ] Add/adjust unit tests for the three behaviors

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged (runbook owned by SP-865)
- [ ] Create `spine-tasks/SP-867-contract-artifacts-fail-closed/.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-865 owns runbook)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — leave to SP-865

## Completion Criteria

- [ ] `..` artifact patterns rejected
- [ ] `**` globs can match real files
- [ ] git diff failure fails must-not-change
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-867): contract artifacts and must-not-change fail-closed (#309)`

## Do NOT

- Change unrelated contract fields (coverage, reviewCommand policy)
- Edit runbook (SP-865)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
