# SP-775: Type reconcile classify/diagnosis/context/light-cache — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-26
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-774 landed (`f603e5c1`, merge `b0fe8e23`; `reconcile.mjs`/`reconcile-batch.mjs`/`reconcile-orphan.mjs` in tsconfig.batch.json include)
- [x] Confirm nocheck on targets (all 4 modules line 1; LOC 433/384/88/61)
- [x] Dependencies satisfied

### Step 1: Type classify/diagnosis cluster
**Status:** ✅ Complete
> ⚠️ Hydrate: Expand based on tsc errors surfaced after stripping nocheck

- [x] Remove nocheck + JSDoc/casts (only 3 errors post-annotation vs 119 probe — SP-774 patterns absorbed most; see Discoveries)
- [x] Expand tsconfig.batch include (4 paths before `types/micromatch.d.ts`)
- [x] Shrink allowlist for this set only (4 rows; 100→96 lines in guard fixture)
- [x] LOC under policy limit (443/383/87/60; `PHASE23_GRANDFATHERED_OVER_500` untouched)

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
| Operator amendment 2026-09-26: `tsconfig.batch.json` + arch guard pre-changed on `main` by SP-774 | `fileScopeMustChange` redirected to the three reconcile modules; still edit tsconfig/allowlist in Step 1 |

## Completion Criteria

- [ ] Four modules typed
- [ ] Allowlist shrunk for this set
- [ ] Partial #284

## Blockers

_None yet._
