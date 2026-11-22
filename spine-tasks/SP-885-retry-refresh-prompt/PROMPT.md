# Task: SP-885 — Refresh PROMPT.md into lane on batch retry

**Created:** 2026-11-22
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Stale lane PROMPT after operator fix-on-main causes repeat contract_failed; wrong sync could overwrite lane STATUS/work.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** `retryTask` resets batch state but does not copy base/`main` packet files into the lane worktree, so contract still enforces the old `fileScopeMustChange`.

## Mission

Closes #378 — `spine batch retry <taskId>` (before resume) must refresh task packet files that operators edit on base (`PROMPT.md` at minimum; STATUS only if safe) from the project tasks root into the lane worktree, or document a clear sync command. Prefer automatic refresh of `PROMPT.md` (and Contract-bearing packet files) from base tasks root → lane task folder, then commit or stage so the next worker run sees the fixed contract.

## Dependencies

- **None**

## Context to Read First

- GitHub #378
- `src/batch/retry.mjs` — `retryTask`
- `bin/spine-batch.mjs` — retry CLI
- `src/batch/engine-lanes/orch-sync.mjs` — task folder resolution patterns
- `tests/batch/batch-retry-failed-phase.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/retry.mjs`
- `bin/spine-batch.mjs`
- `src/batch/engine-lanes/orch-sync.mjs`
- `tests/batch/batch-retry-failed-phase.test.mjs`
- `tests/batch/retry-refresh-prompt.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/batch-retry-failed-phase.test.mjs tests/batch/retry-refresh-prompt.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-885` |
| fileScopeMustChange | `src/batch/retry.mjs`, `tests/batch/retry-refresh-prompt.test.mjs`, `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm retry does not currently copy PROMPT from base
- [ ] Identify lane worktree + task folder paths available at retry time

### Step 1: Refresh packet on retry

- [ ] Copy base tasks-root `PROMPT.md` (and any other contract-bearing packet files you choose) into the lane task folder
- [ ] Do not clobber lane `.DONE` / review artifacts incorrectly
- [ ] Journal a clear event (e.g. `task.packet_refreshed`) when refresh runs
- [ ] Document operator expectation in runbook

### Step 2: Testing & Verification

- [ ] Unit/integration: stale lane PROMPT replaced from base on retry
- [ ] Run Contract `testCommand`

### Step 3: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `skills/spine-release-operator/SKILL.md` (retry recovery note)

## Completion Criteria

- [ ] Retry refreshes PROMPT from base into lane (or documented equivalent that unblocks #378)
- [ ] Tests cover refresh behavior
- [ ] Runbook updated
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-885): refresh lane PROMPT from base on batch retry (#378)`

## Do NOT

- Wipe lane working tree product commits
- Require manual `cp` as the only fix without documenting it as interim
- Change contract verify semantics beyond using refreshed PROMPT
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
