# SP-621: Runbook batch-meta recovery — Status

**Current Step:** Step 2
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-11
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Locate runbook resume/abort/salvage sections
- [x] Confirm SP-620 reconstruct wording

### Step 1: Add batch-meta force-resume section

**Status:** ✅ Complete

- [x] #126 recovery steps
- [x] Detached-first cross-links
- [x] Fail-closed note when meta missing

### Step 2: Testing & Verification

**Status:** 🔄 In Progress

- [ ] Full test suite (docs-only)

### Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

- Resume/abort/salvage live in §6 (`## 6. Resume, dismiss, complete`): Resume, Pause and abort, Batch abort recovery (salvage), Agent-safe state_drift recovery (#196).
- Detached-first (#163/#185) is in **Before you start**.
- SP-620 landed: `src/batch/batch-meta-reconstruct.mjs` (`reconstructBatchStateFromRuntime` / `ensureForceResumeBatchState`); wired from `resume.mjs`; packet has `.DONE`.
- Added `### Force-resume from batch-meta after abort limbo (#126)` after salvage, before #196.

## Discoveries

| Finding | Action |
|---------|--------|
| SP-620 reconstruct already on lane (`.DONE` + `batch-meta-reconstruct.mjs`) | Document operator path only |
| Best insert point: after salvage, before #196 agent-safe | Added § force-resume from batch-meta (#126) there |
