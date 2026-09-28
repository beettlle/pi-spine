# Task: SP-803 — Runbook: v2.26.0 state and lock hardening

**Created:** 2026-09-27
**Size:** S

## Review Level: 0 (None)

**Risk:** Docs only.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Document the operator-visible behavior changes of release v2.26.0 in the operator runbook, in one new subsection under §6, after "v2.25.0 recovery-evidence hardening (#296–#303)", titled `### v2.26.0 state and lock hardening (#293, #299, #301, #302, #304, #305, #307)`.

Cover, one short paragraph or table row each, with the exact event names, config keys and commands (read the landed code to confirm every name before writing it):

1. **#293 / #301** — a late engine finalize after `spine batch complete` no longer recreates `.spine/batch-state.json`; journal events `batch.late_finalize_skipped` and `batch.state_write_rejected`; preflight now suggests `spine batch complete` for a completed, archived batch. Operator pause and engine progress no longer overwrite each other; abort/complete/dismiss archive the state read under the lock.
2. **#302** — stale-lock breaking is race-free; `batch-state.json` writes are fsync'd; engine lock waits no longer freeze lanes; long-wait `[spine]` stderr line; terminal commands report `cleanupWarnings` and journal `batch.cleanup_failed` when post-archive cleanup fails.
3. **#304** — out-of-File-Scope lane merge conflicts fail closed unless the path matches `lanes.outOfScopeMergeAllowList` (list the default); allowed discards are journaled as `batch.merge_out_of_scope_discarded`; non-conflict merge failures are classified `MergeFailed` with git stderr. Recovery: add the path to File Scope, or to the allow-list, then retry.
4. **#305** — contract verification no longer blocks other lanes; timed-out contract commands are killed with their process tree and reported as `timed out after N min`.
5. **#307** — `spine run sequence` waits end with `sequence_wait_timeout` (`orchestrator.sequenceMaxWaitMs`, default) or `engine_stalled` (`orchestrator.sequenceStallMs`, default); recovery `spine status --diagnose`.
6. **#299** — without `SPINE_WORKER_STUB=1`, a worker whose PATH lacks `pi` fails with `launch_failed` and journal `worker.spawn_failed` `reason: "pi_missing"`; fix PATH (detached engines inherit the launching shell's PATH) and `spine batch retry <taskId>`.

Also update the "Last Updated" line at the top of the runbook if it has one.

## Dependencies

- **Task:** SP-790 (late-finalize skip, write-rejected journal, preflight suggestion)
- **Task:** SP-793 (bypass audit — closes #301)
- **Task:** SP-797 (async engine lock wait — closes #302)
- **Task:** SP-796 (cleanup warnings)
- **Task:** SP-798 (merge allow-list, `MergeFailed`)
- **Task:** SP-800 (contract timeout reporting)
- **Task:** SP-801 (`pi_missing`)
- **Task:** SP-802 (sequence wait results and config keys)

## Context to Read First

- `docs/adoption/operator-runbook.md` §6, especially "v2.25.0 recovery-evidence hardening (#296–#303)" (~line 1831) for tone and format
- STATUS.md Discoveries of SP-790 through SP-802

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm every event name, config key, default and command against the landed code (`rg` each one in `src/`)
- [ ] Dependencies satisfied

### Step 1: Write the subsection

- [ ] New §6 subsection covering items 1–6
- [ ] Every name matches the code exactly

**Artifacts:**
- `docs/adoption/operator-runbook.md` (modified)

### Step 2: Testing & Verification

- [ ] Run full suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test` (docs tests must stay green)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] Runbook subsection documents all six behavior changes with exact names

## Git Commit Convention

- `docs(SP-803): runbook for v2.26.0 state and lock hardening`

## Do NOT

- Edit code or tests
- Edit other docs (README, CHANGELOG)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
