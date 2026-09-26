# SP-772: Type matrix/merge engine-lanes — Status

**Current Step:** Step 1 — Type matrix/merge engine-lanes
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-26
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-771 landed (`.DONE` present; review-* in tsconfig include; commits merged)
- [x] Confirm matrix/merge still nocheck (all three carry `// @ts-nocheck` line 1)
- [x] Note LOC vs limit (see Discoveries)
- [x] Dependencies satisfied

### Step 1: Type matrix/merge engine-lanes
**Status:** ⬜ Not Started

- [ ] Remove nocheck + JSDoc
- [ ] Expand tsconfig.batch include
- [ ] Clear remaining engine-lanes allowlist entries

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] lint + Contract testCommand
- [ ] rg nocheck empty under engine-lanes
- [ ] Fix failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| LOC: matrix 509, matrix-run 899, merge 753 — all in `src/batch/engine-lanes/` subdir, which `listBatchModuleLineCounts` (batch-loc-policy) does not count (top-level `src/batch/*.mjs` only) | Type in place; no policy conflict |
| `PHASE23_GRANDFATHERED_OVER_500` in `bin/spine-cli/verify.mjs` is already `[]` (emptied by SP-593) | Nothing to grow; leave as-is |
| `NOCHECK_ALLOWLIST` engine-lanes entries are exactly the three targets; first allowlist entry `src/batch/abort.mjs` has a stray double-tab indent (pre-existing) | Fix indent while pruning the three entries |
| `watch.mjs` in engine-lanes has no nocheck and is not in tsconfig include — already typed, out of scope | Leave untouched |

## Completion Criteria

- [ ] matrix/merge typed
- [ ] Zero engine-lanes allowlist entries
- [ ] Closes #283

## Blockers

_None yet._
