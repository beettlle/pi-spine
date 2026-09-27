# SP-780: Journal tolerates torn lines — Status

**Current Step:** Step 4 (Documentation & Delivery)
**Status:** ✅ Complete
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
**Status:** ✅ Complete

- [x] Per-line try/catch + `{ events, skippedLines }` helper
- [x] Read return shapes unchanged
- [x] Append newline guard
- [x] Doc comment corrected
- [x] Unit tests

### Step 2: Diagnose signal + abort
**Status:** ✅ Complete

- [x] `signals.journalCorruptLines`
- [x] Visible in `--diagnose`
- [x] Abort-with-torn-journal test
- [x] `reconcile-batch.mjs` ≤ 500 lines (499)

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Lint — clean (`--max-warnings 0`)
- [x] Contract `testCommand` — lint + typecheck clean, 26/26 tests pass (journal 23, abort 9 incl. torn-journal abort, diagnose 3)
- [x] Batch suite — `SPINE_WORKER_STUB=1 npm run test:batch`: **1507/1507 pass, 0 failures** (170s)
- [x] Fix all failures — one flake found during authoring (unused imports lint warnings, missing `verbose: true` in direct `reconcileBatch` test call); both fixed

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] Create `.DONE`

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
| 5 | GitNexus impact: `parseJournalLines` CRITICAL (75 nodes, 25 processes), `appendJsonlLineSync` CRITICAL (122 nodes, 36 processes, 1 direct caller). Mitigation: public reader shapes unchanged; guard is no-op on well-formed files; full batch suite (1507 tests) passes. `detect_changes` after each step confirmed only the intended symbols were touched. |
| 6 | `bin/spine-status.mjs --diagnose` renders `result.signals` via wholesale `JSON.stringify`, so any `signals.journalCorruptLines` set by `reconcileBatch` appears automatically. `runSpineStatus` is exported → testable directly. |
| 7 | `reconcileBatch` is defined in `src/batch/reconcile-batch.mjs` (the scoped file) and re-exported via `src/batch/reconcile.mjs` shim. |
| 8 | `reconcileBatch` only includes `signals` in its result when `ctx.verbose` is true (`signals: ctx.verbose ? signals : undefined`) — direct test calls must pass `verbose: true`, which is how `runSpineStatus --diagnose` invokes it. |
| 9 | Final LOC after edits: `journal.mjs` 482, `reconcile-batch.mjs` 499, `journal-checksum.mjs` 110 — all within the 500 cap. |
| 10 | `journalCorruptLines` counts both JSON-parse failures and checksum mismatches (both are corrupt lines); the bounded `lines` list carries `{ lineNumber, byteOffset }` per the contract shape. |

## Blockers

_None._

## Documentation

- **Must Update:** None — `journalCorruptLines` operator runbook coverage is owned by SP-789 per PROMPT.
- **Check If Affected:** `docs/adoption/operator-runbook.md` reviewed; no worker-side edit made (SP-789 owns it).

## Completion Criteria

- [x] Torn middle/final lines no longer hide valid events
- [x] Append after a torn line produces a parseable line
- [x] `--diagnose` reports corrupt line count and offsets
- [x] Abort completes on a torn journal
- [x] Closes #296
