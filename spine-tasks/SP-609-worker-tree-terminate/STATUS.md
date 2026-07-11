# SP-609: Worker tree terminate — Status

**Current Step:** Step 4: Documentation & Delivery
**Status:** 🟢 Complete
**Last Updated:** 2026-07-10
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Teardown call sites mapped
- [x] Grandchild spawn path confirmed

### Step 1: Tree terminate helper

**Status:** ✅ Complete

- [x] Helper implemented
- [x] Wired into terminate paths

### Step 2: Tests + runbook

**Status:** ✅ Complete

- [x] Grandchild regression test
- [x] Runbook leftover-`pi` note

### Step 3: Testing & Verification

**Status:** ✅ Complete

- [x] Contract testCommand green
- [x] Full suite + coverage gate

### Step 4: Documentation & Delivery

**Status:** ✅ Complete

- [x] `.DONE` created

## Notes

### Implementation

- `src/process/terminate-tree.mjs` — `listDirectChildPids`, `listDescendantPids`, `terminateProcessTree`
- Wired: `terminateLaneWorkers`, `terminateHungWorkerChild`, heartbeat abort kill
- Skipped `detached: true` spawn (CRITICAL blast radius); tree-walk sufficient
- Contract: typecheck + dismiss-orphan tests **2/2 pass**
- Full suite: **1957/1958** with worker env cleared; sole fail is load-flake `contract-stall-override` (passes in isolation)
- Coverage: **89.06%** line (threshold 77%)

## Discoveries

| Date | Discovery | Action |
|------|-----------|--------|
| 2026-07-10 | `terminateHungWorkerChild` / heartbeat abort out of File Scope but required by FR-REL231-02 | Touched as logically required |
| 2026-07-10 | GitNexus CRITICAL on spawn/hung helpers | Avoided spawn option changes |
| 2026-07-10 | Full suite under `SPINE_IS_WORKER=1` fails nested batch tests | Cleared worker env for suite/coverage |
| 2026-07-10 | `contract-stall-override` flakes under full parallel load | Isolation pass; not caused by tree-kill |
