# SP-057 Status

**Task:** Checkpoint warnings (FR-STALL-02)
**Last Updated:** 2026-06-03

### Step 1: Signal model refactor — ✅
- Checkpoint vs activity split; `lastCheckpointAt` drives stall deadline
- Config: `checkpointWarningMinutes` (10), `extendGraceOnFileScope` (false)

### Step 2: Warning episode + journal — ✅
- `lane.checkpoint_warning` once per episode with dirtyPaths + suggestion

### Step 3: Operator surfaces — ✅
- `extractJournalDiagnosisHints` includes recent `lane.checkpoint_warning`
- `templates/agents/worker.md` checkpoint discipline note

### Step 4: Tests + verification — ✅
- `tests/batch/checkpoint-warning.test.mjs` (8 tests); `npm test` 345 pass
