# Task: SP-780 — Journal tolerates torn lines

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** The journal is the recovery source of truth; status, reconcile, resume, abort, gate, dashboard, and handoff all read it.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** `parseJournalLines` runs `JSON.parse` on every line without a per-line guard, so one torn line (crash or disk-full during append) makes every journal read throw. `appendJsonlLineSync` never checks for a trailing newline, so the next event is glued onto the torn fragment and the file stays broken. `spine batch abort` then throws partway through and leaves a half-aborted batch.

## Mission

Closes #296 — A journal with a torn line still yields every valid event, new appends stay parseable, `spine status --diagnose` reports the corrupt lines, and abort completes.

1. **Per-line parse tolerance** (`src/batch/journal.mjs`): parse each line in its own `try/catch`. Add an internal/exported helper that returns `{ events, skippedLines }`, where each skipped entry records `lineNumber` (1-based) and `byteOffset`. `readJournalEvents` and `readJournalEventsCached` keep their `object[]` return shape and use the helper. Checksum-mismatch skipping stays as is.
2. **Append newline guard** (`src/batch/journal-checksum.mjs` `appendJsonlLineSync`): before appending, if the file exists and is non-empty and its last byte is not `\n`, write `\n` first, so a torn fragment stays isolated on its own line. Keep the fsync and the EBUSY/ENOENT retry.
3. **Diagnosis signal** (`src/batch/reconcile-batch.mjs`): when the journal has skipped lines, set `signals.journalCorruptLines = { count, lines: [{ lineNumber, byteOffset }] }` (cap the listed entries, e.g. first 20). `bin/spine-status.mjs --diagnose` already renders `signals`; confirm it appears.
4. **Doc comment**: correct the `parseJournalLines` comment so it describes JSON-parse failures as well as checksum mismatches.
5. **Tests**: torn final line, torn middle line, append-after-torn (both valid events read), diagnosis signal present, and `abortBatch` completing (journals `batch.aborted`, clears active state) on a journal with a torn line.

## Dependencies

- **None**

## Context to Read First

- `src/batch/journal.mjs` — `parseJournalLines` (~line 220), `readJournalEvents`, `readJournalEventsCached`
- `src/batch/journal-checksum.mjs` — `appendJsonlLineSync` (~line 56)
- `src/batch/reconcile-batch.mjs` — journal read into `signals` (~lines 180–215)
- `src/batch/abort.mjs` — `readJournalEvents` at ~line 240
- `bin/spine-status.mjs` — `--diagnose` signal rendering (~line 125)
- GitHub #296 (pairs with #303 / SP-786)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`)

## File Scope

- `src/batch/journal.mjs`
- `src/batch/journal-checksum.mjs`
- `src/batch/reconcile-batch.mjs`
- `tests/batch/journal.test.mjs`
- `tests/batch/abort.test.mjs`
- `tests/batch/journal-torn-line-diagnose.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/journal.test.mjs tests/batch/abort.test.mjs tests/batch/journal-torn-line-diagnose.test.mjs` |
| fileScopeMustChange | `src/batch/journal.mjs`, `src/batch/journal-checksum.mjs`, `tests/batch/journal.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce: write one valid event, then `{"type":"x"` without newline, then append — confirm `readJournalEvents` throws at HEAD
- [ ] `rg -n "parseJournalLines|readJournalEvents" src bin tests` — note callers that depend on the return shape
- [ ] Record line counts: `journal.mjs` 463, `reconcile-batch.mjs` 487 — both must stay ≤ 500
- [ ] Dependencies satisfied

### Step 1: Parse tolerance + append guard

- [ ] Per-line `try/catch`; helper returns `{ events, skippedLines }` with `lineNumber` and `byteOffset`
- [ ] `readJournalEvents` / `readJournalEventsCached` return shapes unchanged
- [ ] `appendJsonlLineSync` writes a leading `\n` when the last byte is not a newline
- [ ] `parseJournalLines` doc comment corrected
- [ ] Unit tests: torn final line, torn middle line, append-after-torn

**Artifacts:**
- `src/batch/journal.mjs`, `src/batch/journal-checksum.mjs` (modified)
- `tests/batch/journal.test.mjs` (modified)

### Step 2: Diagnose signal + abort

- [ ] `signals.journalCorruptLines` set in reconcile when skipped lines exist (bounded list)
- [ ] `spine status --diagnose` shows the signal (test through `reconcileBatch` or the status renderer)
- [ ] Abort test: `abortBatch` completes and clears active state on a torn journal
- [ ] `reconcile-batch.mjs` stays ≤ 500 lines — put any new formatting in `journal.mjs` if needed

**Artifacts:**
- `src/batch/reconcile-batch.mjs` (modified)
- `tests/batch/journal-torn-line-diagnose.test.mjs` (new)
- `tests/batch/abort.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-789 owns operator runbook edits for `journalCorruptLines`)

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] Torn middle/final lines no longer hide valid events
- [ ] Append after a torn line produces a parseable line
- [ ] `--diagnose` reports corrupt line count and offsets
- [ ] Abort completes on a torn journal
- [ ] Closes #296

## Git Commit Convention

- `fix(SP-780): tolerate torn journal lines and isolate appends (#296)`

## Do NOT

- Add journal compaction or rotation
- Change the checksum scheme
- Rewrite or repair the journal file on read
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
