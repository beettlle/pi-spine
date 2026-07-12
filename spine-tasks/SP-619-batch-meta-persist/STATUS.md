# SP-619: Persist batch-meta.json — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-11
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Confirm no existing batch-meta module; map start topology sources
- [x] Choose `.spine/runtime/{batchId}/batch-meta.json` write path

### Step 1: Persist helper + start wiring

**Status:** ✅ Complete

- [x] Add save helper with atomic write
- [x] Wire attached + detached batch start
- [x] Include minimum Mission fields

### Step 2: Testing & Verification

**Status:** 🟡 In Progress

- [x] Add `tests/batch/batch-meta-persist.test.mjs`
- [x] Run contract `testCommand`
- [ ] Full suite + coverage gate ≥77%

### Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

### Step 0 plan

- No `batch-meta` module exists today.
- Topology is known in `startBatch` (`engine.mjs`) right after `createInitialBatchState`: `batchId`, `baseBranch`, `orchBranch`, `wavePlan`/`totalWaves`, `tasksRoot`.
- Detached start (`startBatchDetached`) spawns an attached engine child that calls `startBatch` — one persist call in `startBatch` covers both paths.
- Write path: `.spine/runtime/{batchId}/batch-meta.json` via `writeJsonAtomic`.
- `mode` assumption: `"batch"` (orchestration kind; state has no mode field; attached/detached is launch style, not topology).
- Wave→task mapping: reuse `wavePlan` (string[][]).
- lifecycle.mjs / detached-run.mjs: no extra edits — engine path covers both start modes.

### Step 1 notes

- Added `src/batch/batch-meta.mjs` with `saveBatchMetaRuntimeArtifact`.
- Wired in `engine.mjs` immediately after initial `saveEngineBatchState`.
- Contract testCommand passed (3/3).

## Discoveries

| Finding | Action |
|---------|--------|
| No existing batch-meta module | Add `src/batch/batch-meta.mjs` |
| Detached start delegates to `startBatch` child | Single wire site in `engine.mjs` |
| `createInitialBatchState` has no `mode` | Persist `mode: "batch"` |
