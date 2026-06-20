# Task: SP-316 — Attached post-merge SIGTERM land loop

**Created:** 2026-06-20
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Recurrence of post-merge limbo on attached batches — engine receives SIGTERM after final lane merge, gate never opens until manual `batch resume --attached` (#21 on batch `20260620T194352`; related to closed #4/#17).
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #21**: batch `20260620T194352` — all four tasks succeeded, both lane merges completed, but attached engine got `engine.orphan_terminated` with `signal: SIGTERM` before land loop finished. Batch stuck `phase: running`, diagnosis `needs_integrate`, `postMergeLimbo: true`, no integrate gate until operator resumed.

**Required behavior:**

1. **Attached survival:** After last `batch.merge_completed`, attached engine must survive through `finalizeBatchForIntegrate` (gate open + evidence) or auto-hand off to detached engine.
2. **SIGTERM handling:** When parent shell/tooling sends SIGTERM to attached engine post-merge, spawn detached engine to complete land loop instead of orphaning.
3. **Gate availability:** `spine gate approve` must not fail with "No integrate gate found" when all tasks succeeded and merges completed.
4. **Regression test:** Journal fixture from batch `20260620T194352` (`batch.merge_completed` → `engine.orphan_terminated` → resume opens gate).

**Closes:** [#21](https://github.com/beettlle/pi-spine/issues/21)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #21
- `src/batch/post-merge-limbo.mjs` — `finalizeBatchForIntegrate`, `isPostMergeLimbo`
- `src/batch/resume-engine.mjs` — `engine.orphan_terminated`
- `src/batch/engine.mjs` — attached engine lifecycle after merge
- `src/batch/resume-multi.mjs` — postMergeLimbo resume path
- `spine-tasks/SP-281-attached-batch-gate-limbo/PROMPT.md` — prior #4 fix
- `spine-tasks/SP-280-post-merge-gate-auto-open/PROMPT.md` — post-merge gate auto-open
- Journal: `.spine/runtime/20260620T194352/journal/events.jsonl`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/post-merge-limbo.mjs`
- `src/batch/engine.mjs`
- `src/batch/resume-engine.mjs`
- `src/batch/resume-multi.mjs`
- `tests/batch/attached-post-merge-sigterm.test.mjs` (new)
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/attached-post-merge-sigterm.test.mjs tests/batch/post-merge-limbo.test.mjs` |
| fileScopeMustChange | `src/batch/post-merge-limbo.mjs`, `src/batch/engine.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/attached-post-merge-sigterm.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reconstruct issue #21 timeline (`batch.merge_completed` → `engine.orphan_terminated` SIGTERM)
- [ ] Compare with SP-281 regression coverage — identify attached-batch gap
- [ ] Confirm gate missing until `batch resume --attached`

### Step 1: Fix attached post-merge finalize / SIGTERM handoff

- [ ] Ensure `finalizeBatchForIntegrate` runs idempotently after last merge on attached batches
- [ ] On SIGTERM post-merge, spawn detached engine or complete land loop before exit
- [ ] Gate opens without manual resume when all tasks terminal-success

### Step 2: Testing & Verification

- [ ] Regression test from batch `20260620T194352` journal
- [ ] Extend `post-merge-limbo.test.mjs` if shared helpers change
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook — post-merge limbo on attached batches
- [ ] Close issue #21 (`gh issue close 21`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — attached post-merge SIGTERM recovery

**Check If Affected:**

- `docs/EXECUTION-FLOW.md` — land loop sequence

## Completion Criteria

- [ ] Attached batch opens integrate gate after last merge without manual resume
- [ ] SIGTERM post-merge does not leave batch in unrecoverable limbo
- [ ] Tests pass with coverage gate
- [ ] Issue #21 closed

## Git Commit Convention

- `feat(SP-316): complete Step N — description`
- `fix(SP-316): description`
- `test(SP-316): description`

## Do NOT

- Remove integrate gate approval requirement
- Auto-integrate without gate approve
- Duplicate SP-315 orphan-retry scope (keep merge/land-loop focus)

---

## Amendments (Added During Execution)
