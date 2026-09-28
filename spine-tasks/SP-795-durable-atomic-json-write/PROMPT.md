# Task: SP-795 — Durable writeJsonAtomic (fsync file and directory)

**Created:** 2026-09-27
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Every atomic JSON write (batch-state, history, gate records) goes through this helper; a mistake breaks all state persistence.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** `writeJsonAtomic` (`src/fs/atomic-write.mjs` ~21-40) does `writeFileSync(tmp)` + `renameSync` with no `fsync`, so the authoritative `batch-state.json` is not durable across power loss or a kernel crash. Journal append (`src/batch/journal-checksum.mjs` ~56-84) and archives (`src/batch/abort.mjs` ~68-73, `src/batch/lifecycle-archive.mjs` ~32) already fsync.

## Mission

Partial #302 — `writeJsonAtomic` fsyncs the temp file before rename and the parent directory after rename.

1. Replace `writeFileSync(tmp)` with `openSync(tmp, "w")` → `writeSync` → `fsyncSync(fd)` → `closeSync(fd)` (close in `finally`) → `renameSync(tmp, target)` → open the parent directory read-only, `fsyncSync`, close. Tolerate `EISDIR`, `EPERM`, `EINVAL` and `EBADF` on the directory open/fsync (win32 and some filesystems), and only there.
2. Keep the existing temp-file naming, cleanup-on-error behavior and the function signature unchanged.
3. **Tests** in `tests/fs/atomic-write.test.mjs`: with `mock.method(fs, "fsyncSync")` assert it is called for the file fd and for the directory fd, in that order relative to `renameSync`; a directory-fsync `EPERM` is tolerated and the write still lands; a file-fsync error propagates and leaves no temp file behind.

## Dependencies

- **None**

## Context to Read First

- GitHub #302 (defect 3 and proposed solution step 4)
- `src/fs/atomic-write.mjs`
- `src/batch/journal-checksum.mjs` ~56-84 — existing fsync pattern

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/fs/atomic-write.mjs`
- `tests/fs/atomic-write.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/fs/atomic-write.test.mjs tests/batch/batch-state-lock.test.mjs` |
| fileScopeMustChange | `src/fs/atomic-write.mjs`, `tests/fs/atomic-write.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] `rg -n "writeJsonAtomic" src` — note caller count
- [ ] Dependencies satisfied

### Step 1: Durable write

- [ ] File fsync before rename; directory fsync after
- [ ] Only the listed directory-fsync errors tolerated
- [ ] Signature and temp cleanup unchanged

**Artifacts:**
- `src/fs/atomic-write.mjs` (modified)

### Step 2: Tests

- [ ] fsync call-order test
- [ ] Directory `EPERM` tolerated
- [ ] File fsync error propagates, no temp left

**Artifacts:**
- `tests/fs/atomic-write.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run full suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-803)

**Check If Affected:**
- None

## Completion Criteria

- [ ] `writeJsonAtomic` fsyncs the file and the directory

## Git Commit Convention

- `fix(SP-795): fsync file and directory in writeJsonAtomic (#302)`

## Do NOT

- Change the lock module (SP-794, SP-797)
- Change archive or journal fsync code
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
