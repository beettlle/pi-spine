# SP-600: Extract sequence-run.mjs — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm SP-582 complete (lane-1 `.DONE` + `sequence-plan.mjs`; brought into this worktree)

### Step 1: Extract / complete split
**Status:** ✅ Complete
- [x] Move remainder; thin `sequence.mjs` ≤500 LOC (27 LOC facade)
- [x] Preserve all public exports via re-export

### Step 2: Testing & Verification
**Status:** 🟡 In Progress
- [x] `node --test tests/batch/sequence-release-profile.test.mjs` (11/11 pass)
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Notes

- Plan: extract `waitForSequenceBatchTerminal`, `runSequenceWaveLandLoop`, `runSequence` (+ diagnosis helpers) into `sequence-run.mjs`; keep `sequence.mjs` as thin re-export facade over `sequence-plan.mjs` + `sequence-run.mjs`.
- Blast radius: LOW (GitNexus); public API preserved via re-exports from `sequence.mjs`.
- LOC: sequence.mjs=27, sequence-plan.mjs=234, sequence-run.mjs=565
