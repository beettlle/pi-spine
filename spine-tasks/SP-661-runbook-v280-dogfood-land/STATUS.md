# SP-661: Runbook v2.8.0 dogfood land — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** ✅ Complete
**Last Updated:** 2026-07-13
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Required files and paths exist
- [x] Dependencies satisfied

### Step 1: Add v2.8.0 dogfood land section
**Status:** ✅ Complete
- [x] Document F1 graphify re-clean (#206)
- [x] Document .pi-smart-router auto-clean
- [x] Document post-DONE orphan heal + diagnose honesty (#205)
- [x] Document single resume owner (#207) + detached-first
- [x] Link post-mortem

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Run full stub test suite
- [x] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Must Update docs modified
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| SP-656–660 all have `.DONE` on this worktree | Dependencies satisfied; proceed with docs |
| Place new section after v2.7.0 operator UX (§6) | Matches existing release-hygiene pattern; cross-link post-mortem |
| Also refreshed GitignoredDirtyWorktree table + Related docs | In-scope operator-runbook.md only; keeps F1 discoverable from land-loop table |
| First `npm test` failed with nested_batch_spawn_blocked | Unset `SPINE_IS_WORKER` (+ batch worker env) for suite; keep `SPINE_WORKER_STUB=1` |

## Completion Criteria

- [x] Runbook covers #205/#206/#207 and detached-first

## Blockers

_None._
