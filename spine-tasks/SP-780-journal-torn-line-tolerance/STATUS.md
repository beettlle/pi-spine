# SP-780: Journal tolerates torn lines — Status

**Current Step:** Step 1 (Parse tolerance + append guard)
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Reproduce torn-line throw at HEAD
- [x] List journal read callers
- [x] Record LOC baselines
- [x] Dependencies satisfied

### Step 1: Parse tolerance + append guard
**Status:** 🔄 In Progress

- [ ] Per-line try/catch + `{ events, skippedLines }` helper
- [ ] Read return shapes unchanged
- [ ] Append newline guard
- [ ] Doc comment corrected
- [ ] Unit tests

### Step 2: Diagnose signal + abort
**Status:** ⬜ Not Started

- [ ] `signals.journalCorruptLines`
- [ ] Visible in `--diagnose`
- [ ] Abort-with-torn-journal test
- [ ] `reconcile-batch.mjs` ≤ 500 lines

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Step 1 Plan (Review Level 2 checkpoint)

1. `src/batch/journal.mjs`: export `parseJournalLines` returning `{ events, skippedLines }`; each skipped entry `{ lineNumber (1-based), byteOffset, reason }` (reason: `json_parse_error` | `checksum_mismatch`). Per-line `try/catch`. `readJournalEvents` / `readJournalEventsCached` take `.events` — public `object[]` shapes unchanged. Doc comment corrected to cover JSON-parse failures.
2. `src/batch/journal-checksum.mjs`: internal `appendNewlineIfTornTail(filePath)` — when file exists, is non-empty, and last byte ≠ `\n`, append `\n` before the payload; called inside the existing EBUSY/ENOENT retry loop before `appendFileSync`; fsync behavior untouched.
3. Tests (`tests/batch/journal.test.mjs`): torn final line (events + skipped metadata), torn middle line, append-after-torn (both valid events read, fragment isolated on own line), cached reader shape unchanged.

## Discoveries

| # | Finding |
|---|---------|
| 1 | Repro confirmed at HEAD: torn final line `{"type":"x"` (no newline) makes `readJournalEvents` throw `SyntaxError: Expected ',' or '}' after property value`; subsequent `appendJournalEvent` glues onto the fragment (`{"type":"x"{"schemaVersion":1,...}`) and reads still throw. |
| 2 | `appendJsonlLineSync` has exactly one caller: `appendJournalEvent` (journal.mjs), which always passes newline-terminated lines — newline guard is a no-op on healthy files. |
| 3 | ~30 `readJournalEvents` call sites in src/ + 3 `readJournalEventsCached` (dashboard snapshot, heartbeat, attached-runner-promote); all consume `object[]` — shapes must not change. |
| 4 | LOC baselines: `journal.mjs` 463, `reconcile-batch.mjs` 487 (both must stay ≤ 500; headroom 37 / 13). |
| 5 | GitNexus impact: `parseJournalLines` CRITICAL (75 nodes, 25 processes), `appendJsonlLineSync` CRITICAL (122 nodes, 36 processes, 1 direct caller). Mitigation: public reader shapes unchanged; guard is no-op on well-formed files; full batch suite verifies. |
| 6 | `bin/spine-status.mjs --diagnose` renders `result.signals` via wholesale `JSON.stringify`, so any `signals.journalCorruptLines` set by `reconcileBatch` appears automatically. `runSpineStatus` is exported → testable directly. |
| 7 | `reconcileBatch` is defined in `src/batch/reconcile-batch.mjs` (the scoped file) and re-exported via `src/batch/reconcile.mjs` shim. |

## Blockers

_None._
