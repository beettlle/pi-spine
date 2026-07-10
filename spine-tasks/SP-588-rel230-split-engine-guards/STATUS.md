# SP-588: Extract engine nested-spawn guard — Status

**Current Step:** Step 3
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for engine.mjs
- [x] Confirm dependencies satisfied
- [x] Identify public exports to preserve via re-export

### Step 1: Create extracted module(s)
**Status:** ✅ Complete

- [x] Create `src/batch/batch-guards.mjs`
- [x] Move implementations per handoff: nested-spawn guard → batch-guards.mjs
- [x] Keep each new file ≤500 LOC

### Step 2: Re-export
**Status:** ✅ Complete

- [x] Remove moved code from `src/batch/engine.mjs`
- [x] Re-export public symbols from new module(s)
- [x] Confirm module ≤500 LOC (grandfather removal deferred to SP-593)

### Step 3: Testing & Verification
**Status:** 🔄 In Progress

- [ ] Run targeted test: `node --test tests/batch/nested-spawn-guard.test.mjs`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify `src/batch/engine.mjs` ≤500 LOC (or removed from grandfather list with justification)

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Log discoveries in STATUS.md
- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- **Plan (RL1):** Extract `detectNestedWorkerContext` + nested-start reject helper into `batch-guards.mjs`; re-export `detectNestedWorkerContext` from `engine.mjs`; `startBatch` calls helper. No behavior change. Tests keep importing from `engine.mjs`.
- Plan review at Step 0: skipped (real-pi / SP-195) — engine reviews after `.DONE`.

## Discoveries

| Date | Finding |
|------|---------|
| 2026-07-10 | Public symbol to preserve: `detectNestedWorkerContext` (imported by nested-spawn-guard + contract-verify-nested-spawn tests via `engine.mjs`) |
| 2026-07-10 | GitNexus impact on `detectNestedWorkerContext`: LOW (0 upstream callers indexed beyond file) |
| 2026-07-10 | SP-577 `.DONE` present; SP-603 wave-gate not marked `.DONE` in this worktree — engine scheduled SP-588 so proceed |
| 2026-07-10 | Detector alone left engine ~510; also moved `rejectNestedBatchStart` (journal + error result) into `batch-guards.mjs`; compacted typedef/JSDoc to land ≤500 |
| 2026-07-10 | LOC after split: `engine.mjs` 497, `batch-guards.mjs` 69 |
