# Task: SP-705 — Journal checksum + append serialize

**Created:** 2026-08-15
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Additive fields on the existing jsonl append path; GitNexus blast on `appendJournalEvent` is CRITICAL so keep schema compatible.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #120 — Harden append-only journal writes in `src/batch/journal.mjs` without changing call sites. Add a SHA-256 checksum field on **new** events; keep existing jsonl lines readable (missing checksum is valid/legacy). Serialize in-process appends; retry bounded on EBUSY/ENOENT. Keep `fs.appendFileSync` + existing fsync — **do not** rewrite the whole jsonl via `writeTextAtomic` per event (loses concurrent appends, O(n) per write). Directory fsync after append is allowed. `JOURNAL_SCHEMA_VERSION` stays backward compatible. Tests in `tests/batch/journal.test.mjs`.

## Dependencies

- **None**

## Context to Read First

- `src/batch/journal.mjs` — `appendJournalEvent`, `readJournalEvents`, `JOURNAL_SCHEMA_VERSION`
- `tests/batch/journal.test.mjs`
- `src/fs/atomic-write.mjs` — PID-stamped temps for **non-append** artifacts; do not use as jsonl rewrite
- GitHub #120
- `spine-tasks/_authoring/release-v2.14.0/manifest.md` — CRITICAL blast note

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/journal.mjs`
- `tests/batch/journal.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/journal.test.mjs` |
| fileScopeMustChange | `src/batch/journal.mjs`, `tests/batch/journal.test.mjs` |
| fileScopeMustNotChange | `src/batch/review-shared.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm `appendJournalEvent` already uses `appendFileSync` + `fsyncSync`
- [ ] Confirm `readJournalEvents` / `normalizeJournalEvent` still accept schema v1 lines without checksum

### Step 1: Checksum, serialize, retry

- [ ] Add SHA-256 checksum on newly written events (field name documented in a one-line comment on the writer)
- [ ] In-process serialize concurrent `appendJournalEvent` calls
- [ ] Bounded retry on EBUSY/ENOENT (fail fast after cap)
- [ ] `readJournalEvents` skips checksum when absent; if present, mismatch must not invent events (skip or fail-closed per-line without throwing away the rest of the file)
- [ ] Tests: new event has checksum; legacy line without checksum still loads; concurrent appends do not interleave half-lines

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- _(none — code comment on checksum field is sufficient)_

**Check If Affected:**
- `docs/PRD.md` journal spec — only if a schema field must be named; prefer comment in `journal.mjs`

## Completion Criteria

- [ ] New events carry a SHA-256 checksum
- [ ] Legacy jsonl without checksum still reads
- [ ] Append remains jsonl append + fsync (no whole-file rewrite)
- [ ] Concurrent appends serialized; EBUSY/ENOENT retried with a bound
- [ ] Scoped tests pass

## Do NOT

- Rewrite the journal file via `writeTextAtomic` / temp+rename of the entire jsonl on each event
- Bump `JOURNAL_SCHEMA_VERSION` in a way that breaks existing readers
- Change `appendJournalEvent` call signature (options object may grow; positional args stay)
- Edit `src/batch/review-shared.mjs` (SP-706)
- Edit `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-705): journal checksum serialize and append retry (#120)`
