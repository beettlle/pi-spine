# SP-589: Extract integrate tryRestoreBranch helper — Status

**Current Step:** Step 3
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for integrate.mjs
- [x] Confirm dependencies satisfied (SP-587 `.DONE` present)
- [x] Identify public exports to preserve via re-export (`integrateOrchToBase`, `assertOrchIntegratable`; new `tryRestoreBranch`)

### Step 1: Create extracted module(s)
**Status:** ✅ Complete

- [x] Create `src/batch/integrate-git.mjs`
- [x] Move three identical checkout-recovery try/catch blocks → `tryRestoreBranch`
- [x] Keep each new file ≤500 LOC (`integrate-git.mjs` 21, `integrate.mjs` 496)

### Step 2: Re-export
**Status:** ✅ Complete

- [x] Remove moved code from `src/batch/integrate.mjs`
- [x] Re-export public symbols from new module(s)
- [x] Remove `src/batch/integrate.mjs` from `PHASE23_GRANDFATHERED_OVER_500`

### Step 3: Testing & Verification
**Status:** 🟡 In Progress

- [x] Run targeted test: `node --test tests/batch/batch-salvage-integrate.test.mjs` (7 pass, 0 fail)
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [x] Verify `src/batch/integrate.mjs` ≤500 LOC (496)

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Log discoveries in STATUS.md
- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Real-pi worker: plan/code/final review deferred to engine after `.DONE` (SP-195/SP-278)
- GitNexus impact on `integrateOrchToBase`: LOW (callers: `startBatch`, `runSequenceWaveLandLoop`)

## Discoveries

| Finding | Action |
|---------|--------|
| Three identical `git checkout previous \|\| baseBranch` try/catch blocks | Extracted as `tryRestoreBranch` in `integrate-git.mjs` |
| Fourth try/catch (checkout base + reset --hard) is different — not part of #116 helper | Left in `integrate.mjs` |
| SP-587 dependency satisfied (`.DONE` present) | Proceeded |
| `integrate.mjs` 496 LOC after extract | Removed from grandfather list |
