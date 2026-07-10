# SP-582: Split sequence.mjs — Status

**Current Step:** Step 2
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for sequence.mjs (`batch-module-split-v23/findings.md`)
- [x] List public exports to preserve:
  - Plan (→ `sequence-plan.mjs`): `SEQUENCE_RELEASE_PROFILE`, `isReleaseSequenceScope`, `resolveSequenceProfile`, `validateReleaseSequenceWaveCaps`, `buildReleaseSequenceDryRunHeader`, `resolveSequenceWaves`, `buildSequenceWaveCommands`, `buildSequenceDryRunPlan`, `buildSequencePlan`
  - Run (stays in `sequence.mjs` for SP-600): `isSequenceBatchSettled`, `isSequenceBatchFailure`, `isSequenceBatchWaiting`, `waitForSequenceBatchTerminal`, `runSequenceWaveLandLoop`, `runSequence`
  - Re-export: `resolveWaveTaskIds`

### Step 1: Extract sequence-plan.mjs
**Status:** ✅ Complete

- [x] Create `src/batch/sequence-plan.mjs` (~230 LOC)
- [x] Re-export plan symbols from `sequence.mjs`

### Step 2: Testing & Verification
**Status:** 🔄 In Progress

- [ ] `node --test tests/batch/sequence-preflight.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230); second half (`runSequence`) deferred to SP-600
- `bin/spine-cli/verify.mjs` grandfather entry unchanged per PROMPT (SP-593)
