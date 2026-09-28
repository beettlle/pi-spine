# SP-790: Refuse post-archive batch-state resurrection — Status

**Current Step:** Not Started
**Status:** ⬜ Not Started
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Reproduce #293
- [ ] List + classify `bypassWriteGuard: true` sites
- [ ] List tests pinning guard behavior
- [ ] Dependencies satisfied

### Step 1: Guard + bypass semantics + rejected-write journal
**Status:** ⬜ Not Started

- [ ] Resurrection rejected for every phase
- [ ] Bypass = owner check only; `allowArchivedResurrection` at recovery sites
- [ ] `batch.state_write_rejected` journaled
- [ ] `isBatchArchived` exported

### Step 2: Late finalize + preflight suggestion
**Status:** ⬜ Not Started

- [ ] Late finalize skipped after archive
- [ ] Preflight suggests `spine batch complete`

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] #293 regression test
- [ ] Guard tests
- [ ] Preflight test

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Bypass-site classification logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|

## Blockers

_None._
