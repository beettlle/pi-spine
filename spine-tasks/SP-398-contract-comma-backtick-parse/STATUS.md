# SP-398: Contract comma-in-backtick path parse fix — Status

**Current Step:** Step 4
**Status:** 🟢 Complete
**Last Updated:** 2026-07-01
**Review Level:** 2
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #61 and SP-396 contract.verified failure (malformed `` `path-a` `` / `` path-b` `` tokens)
- [x] Traced parseContractPathList → parseContractScalar; verifyStubFileScopeMustChange uses parsed patterns

### Step 1: Fix path list parsing
**Status:** ✅ Complete

- [x] Strip single outer backtick wrapper before comma-split in `parseContractPathList`
- [x] Preserve per-path backticks, plain comma lists, and `see File Scope`

### Step 2: Authoring guard
**Status:** ✅ Complete

- [x] `detectCommaInSingleBacktickPathLists` + `validateContract` warn/error
- [x] Updated `contract-template.md` with per-path backtick guidance

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Regression tests for comma-in-backtick and SP-396 paths
- [x] Full suite: 1354/1354 pass (`npm run typecheck && SPINE_WORKER_STUB=1 npm test`)
- [x] Coverage gate: 87.83% line (`npm run coverage:check`)

### Step 4: Delivery
**Status:** ✅ Complete

- [x] Close GitHub issue #61
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Finding | Impact |
|---------|--------|

---

## Blockers

*None*
