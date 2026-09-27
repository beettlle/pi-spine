# SP-774: Type reconcile-batch/orphan + reconcile facade — Status

**Current Step:** Step 0 — Preflight
**Status:** ⬜ Not Started
**Last Updated:** 2026-09-26
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

## Progress Checklist

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm nocheck on targets
- [ ] Note tsconfig/allowlist state
- [ ] Record reconcile-batch LOC baseline
- [ ] Dependencies satisfied

### Step 1: Type reconcile facade + batch/orphan
**Status:** ⬜ Not Started
> ⚠️ Hydrate: Expand based on tsc errors surfaced after stripping nocheck

- [ ] Remove nocheck + JSDoc/casts
- [ ] Expand tsconfig.batch include
- [ ] Shrink allowlist for this set only
- [ ] reconcile-batch.mjs ≤ 499 lines

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] lint + Contract testCommand
- [ ] Full suite (worker env unset)
- [ ] Coverage gate ≥77%
- [ ] Fix failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| | |

## Completion Criteria

- [ ] Three modules typed
- [ ] Allowlist shrunk for this set
- [ ] Partial #284

## Blockers

_None yet._
