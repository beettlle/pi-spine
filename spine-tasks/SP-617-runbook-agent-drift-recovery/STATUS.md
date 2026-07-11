# SP-617: Runbook agent drift recovery — Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-11
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Locate runbook sections
- [x] Confirm SP-613 recovery wording

### Step 1: Add agent drift recovery section

**Status:** ✅ Complete

- [x] #196 recovery steps
- [x] Detached-first cross-links
- [x] Abort dry-run note

### Step 2: Testing & Verification

**Status:** ✅ Complete

- [x] Full test suite

### Step 3: Documentation & Delivery

**Status:** ✅ Complete

- [x] `.DONE` created

## Notes

Preflight:
- Runbook anchors: Detached-first (§Before you start), orphan recovery tree, state_drift operator implications (~L608), §6 Resume/salvage/orphan, Review crash state_drift (§6).
- SP-613 on lane/main: `buildSuggestedCommand` for `state_drift` prefers detached `spine batch resume --force` (never `--attached`); pidless terminal-success + pending merge is resume-eligible. SP-613 `.DONE` present.
- SP-614 salvage lane commits complete; SP-615 abort dry-run still in progress on parallel lane — document contracted read-only dry-run behavior.

Step 1:
- Added §6 **Agent-safe state_drift recovery (#196)** (diagnose → detached resume → abort → salvage → manual FF last resort).
- Aligned orphan tree, state_drift operator implications, diagnosis quick map; noted abort `--dry-run` read-only (SP-615) and salvage after abort (SP-614).

Step 2:
- First run failed under inherited `SPINE_IS_WORKER=1` (nested_batch_spawn_blocked) — expected per runbook §9 / #132.
- Re-ran with worker env unset: `npm run typecheck` OK; `SPINE_WORKER_STUB=1 npm test` → 1983 pass / 0 fail (duration ~283s).
- Contract `testCommand`: `true`.

## Discoveries

| Finding | Action |
|---------|--------|
| Orphan tree + state_drift bullets still mention `--attached --force` for agent path | Aligned with #196 / #163 detached-first |
| SP-615 not complete on this worktree | Documented intended SP-615 contract (abort --dry-run read-only) |
| Full suite under SPINE_IS_WORKER=1 hits nested_batch_spawn_blocked | Re-ran with worker env cleared per runbook §9 |
