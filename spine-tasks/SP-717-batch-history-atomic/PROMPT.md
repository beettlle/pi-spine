# Task: SP-717 — Atomic batch-history append; no silent wipe

**Created:** 2026-08-22
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** State persistence correctness; audit trail integrity.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #261 — Replace non-atomic `appendBatchHistoryEntry` read-modify-write with `writeJsonAtomic`. On parse failure, quarantine corrupt file instead of resetting to `[]`. Add concurrent append test.

## Dependencies

- **None**

## Context to Read First

- `src/batch/state-io.mjs` — `appendBatchHistoryEntry`, `saveSpineBatchState`
- `src/batch/lifecycle.mjs` — complete/archive callers
- GitHub #261, #264 (defer lock to follow-up)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/state-io.mjs`
- `tests/batch/batch-history-atomic.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-history-atomic.test.mjs` |
| fileScopeMustChange | `tests/batch/batch-history-atomic.test.mjs` |

## Steps

### Step 1: Atomic history writes

- [ ] Use `writeJsonAtomic` for history append (or JSONL migration if simpler)
- [ ] Remove bare `writeFileSync` on happy path

### Step 2: Corrupt file handling

- [ ] Quarantine to `.spine/runtime/batch-history.json.corrupt.{timestamp}`
- [ ] Operator-visible error; never silent `[]` reset

### Step 3: Testing & Verification

- [ ] Concurrent append test (two entries retained)
- [ ] Corrupt-file quarantine test
- [ ] Run contract `testCommand` only

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — batch history corruption recovery

## Completion Criteria

- [ ] Atomic writes; corrupt file quarantined
- [ ] Concurrent append test passes
- [ ] Closes #261

## Do NOT

- Implement global batch-state lock (#264 — separate issue)
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-717): atomic batch-history append with corrupt quarantine (#261)`
