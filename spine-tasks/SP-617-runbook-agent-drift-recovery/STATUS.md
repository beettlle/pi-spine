# SP-617: Runbook agent drift recovery — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
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

**Status:** 🟡 In Progress

- [ ] #196 recovery steps
- [ ] Detached-first cross-links
- [ ] Abort dry-run note

### Step 2: Testing & Verification

**Status:** ⬜ Not Started

- [ ] Full test suite

### Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

Preflight:
- Runbook anchors: Detached-first (§Before you start), orphan recovery tree, state_drift operator implications (~L608), §6 Resume/salvage/orphan, Review crash state_drift (§6).
- SP-613 on lane/main: `buildSuggestedCommand` for `state_drift` prefers detached `spine batch resume --force` (never `--attached`); pidless terminal-success + pending merge is resume-eligible. SP-613 `.DONE` present.
- SP-614 salvage lane commits complete; SP-615 abort dry-run still in progress on parallel lane — document contracted read-only dry-run behavior.

## Discoveries

| Finding | Action |
|---------|--------|
| Orphan tree + state_drift bullets still mention `--attached --force` for agent path | Align with #196 / #163 detached-first in same edit |
| SP-615 not complete on this worktree | Document intended SP-615 contract (abort --dry-run read-only) |
