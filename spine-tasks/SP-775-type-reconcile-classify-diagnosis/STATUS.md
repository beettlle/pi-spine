# SP-775: Type reconcile classify/diagnosis/context/light-cache — Status

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

- [ ] Confirm SP-774 landed
- [ ] Confirm nocheck on targets
- [ ] Dependencies satisfied

### Step 1: Type classify/diagnosis cluster
**Status:** ⬜ Not Started
> ⚠️ Hydrate: Expand based on tsc errors surfaced after stripping nocheck

- [ ] Remove nocheck + JSDoc/casts
- [ ] Expand tsconfig.batch include
- [ ] Shrink allowlist for this set only
- [ ] LOC under policy limit

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

- [ ] Four modules typed
- [ ] Allowlist shrunk for this set
- [ ] Partial #284

## Blockers

_None yet._
