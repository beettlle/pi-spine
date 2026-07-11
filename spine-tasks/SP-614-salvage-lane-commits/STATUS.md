# SP-614: Salvage lane commits — Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-11
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Reproduce empty salvage with branch ahead
- [x] Map journal vs git evidence gap

### Step 1: Detect and land lane branch commits

**Status:** ✅ Complete

- [x] List salvageable lanes from branch evidence
- [x] Integrate without false lane_not_salvageable
- [x] Keep exit-reason exclusions

### Step 2: Testing & Verification

**Status:** ✅ Complete

- [x] Regression tests
- [x] Contract testCommand
- [x] Full suite + coverage gate

### Step 3: Documentation & Delivery

**Status:** ✅ Complete

- [x] `.DONE` created

## Notes

Plan (Review Level 1):
1. Root cause: `isSalvageableTask` requires journal `lane.committed` before git branch evidence is considered.
2. Fix: treat terminal-success / doneInLane / doneFileFound tasks as salvage candidates without `lane.committed`; enrich from archive seed (rebuild drops doneInLane); keep git commits-ahead as the hard gate; keep NON_SALVAGEABLE_EXIT_REASONS exclusions.
3. Integrate already uses `listSalvageableLanes` — fixing list fixes false `lane_not_salvageable`.
4. Add regression: succeeded + branch ahead + no `lane.committed` → list + integrate succeed.

Verification:
- Contract: typecheck + salvage list/integrate tests — 18 pass
- Full suite (SPINE_WORKER_STUB=1, nest env cleared): 1980 pass / 0 fail
- Coverage: 88.85% line (threshold 77%)

## Discoveries

| Finding | Action |
|---------|--------|
| `isSalvageableTask` requires journal `lane.committed`; git branch ahead is checked only after that filter — #196 empty salvage | Drop journal-commit gate for terminal-success / doneInLane candidates; keep git commits-ahead + exit-reason exclusions |
| Journal rebuild strips seed `doneInLane` | Enrich rebuilt tasks from archive seed before salvage classification |
| Full `npm test` inside worker inherits `SPINE_IS_WORKER=1` and fails nested batch starts | Cleared nest env for suite/coverage runs |
