# Task: SP-886 — Fix batch complete vs land-loop finalize race

**Created:** 2026-11-22
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Operators hit false `batch_state_changed_during_terminal_write` after successful integrate; retry works — UX and land-loop trust.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** #371 mitigation incomplete — first `spine batch complete` after integrate still races engine finalize writing batch-state; second complete succeeds.

## Mission

Closes #379 — After successful gate approve + integrate, the first `spine batch complete` must not fail with `batch_state_changed_during_terminal_write` when the engine is only finishing land-loop finalize. Either wait/retry inside complete, delay suggesting complete until finalize is done, or return a pending diagnosis with a clear wait command (not a hard failure that implies corruption).

## Dependencies

- **Task:** SP-885 (serialize shared `docs/adoption/operator-runbook.md` File Scope)

## Context to Read First

- GitHub #379 (regression of #371)
- `src/batch/lifecycle.mjs` — `completeBatch`
- `src/batch/lifecycle-archive.mjs` — `reloadStateForTerminalWrite` / `batch_state_changed_during_terminal_write`
- `tests/batch/late-finalize-after-complete.test.mjs`
- `tests/batch/batch-complete-engine.test.mjs`
- `docs/adoption/operator-runbook.md` — land loop / complete

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lifecycle.mjs`
- `src/batch/lifecycle-archive.mjs`
- `src/cli/batch-complete.mjs`
- `tests/batch/late-finalize-after-complete.test.mjs`
- `tests/batch/batch-complete-engine.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/late-finalize-after-complete.test.mjs tests/batch/batch-complete-engine.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-886` |
| fileScopeMustChange | `src/batch/lifecycle-archive.mjs`, `tests/batch/late-finalize-after-complete.test.mjs`, `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Reproduce failure mode from #379 / existing late-finalize tests
- [ ] Map complete → reloadStateForTerminalWrite → live engine active phase

### Step 1: Eliminate false-hard failure

- [ ] Wait/retry, pending diagnosis, or finalize-before-suggest so first complete succeeds or instructs wait without implying corruption
- [ ] Preserve fail-closed when batch truly changed identity / became active for real work
- [ ] Keep journal observability for skipped late finalize

### Step 2: Testing & Verification

- [ ] Extend regression covering post-integrate first complete
- [ ] Run Contract `testCommand`

### Step 3: Documentation & Delivery

- [ ] Update runbook land-loop note
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `skills/spine-release-operator/SKILL.md` §4.3

## Completion Criteria

- [ ] First `batch complete` after integrate no longer hard-fails on pure finalize race
- [ ] Tests cover the race
- [ ] Runbook updated
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-886): harden batch complete against land-loop finalize race (#379)`

## Do NOT

- Remove terminal-write lock safety for true state identity changes
- Auto-approve gates or skip integrate
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
