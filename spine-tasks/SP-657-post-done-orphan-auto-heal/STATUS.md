# SP-657: Post-DONE orphan auto-heal — Status

**Current Step:** Step 0 — Preflight
**Status:** ⬜ Not Started
**Last Updated:** 2026-07-13
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ⬜ Not Started
- [ ] Reproduce .DONE + dead worker/engine → merge_blocked today
- [ ] Inventory skippedDoneOnDisk sites

### Step 1: Auto-heal before merge_blocked
**Status:** ⬜ Not Started
- [ ] Heal via skip-done path before failed merge_blocked
- [ ] Reuse skippedDoneOnDisk / resume-multi semantics
- [ ] Add post-DONE orphan heal fixture

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Run contract testCommand
- [ ] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`
- [ ] Do not close #205

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| — | — |

## Completion Criteria

- [ ] Post-DONE orphan not in merge_blocked failed set when evidence present
- [ ] Reuses skip-done semantics
- [ ] Scoped tests green

## Blockers

_None._
